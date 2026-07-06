/* eslint-disable @typescript-eslint/no-explicit-any -- Web Bluetooth no está en lib.dom */
// Tensión arterial — registro + lectura BLE del tensiómetro.
//
// Dos vías de lectura por Web Bluetooth (Chrome/Edge en Android y escritorio;
// Safari/iOS no soporta Web Bluetooth → registro manual):
//  1. Perfil GATT estándar "Blood Pressure Service" (0x1810) — monitores genéricos.
//  2. Protocolo propietario Viatom/Lepu del Checkme BP2/BP2A, según el SDK
//     oficial (github.com/viatom-develop/LepuBle):
//       trama  = [0xA5, cmd, ~cmd, 0x00, seq, len_lo, len_hi, …data, crc8]
//       cmd 0x08 (RtData) → RtParam(9B: status/batería) + RtWave:
//         type 0x01 (BpResult): isDeflate(1) presión(2LE) sys(2LE) dia(2LE)
//                               media(2LE) pulso(2LE) estado(1) diagnóstico(1)

export interface BpReading {
  sys: number
  dia: number
  pulse?: number
  source: 'manual' | 'ble-estandar' | 'ble-checkme'
}

export interface BpProgress {
  phase: 'conectando' | 'midiendo' | 'inflando' | 'resultado'
  pressure?: number   // presión del manguito durante la medición (Checkme)
  message: string
}

// Clasificación orientativa (ESH 2023) para colorear la UI. No es diagnóstico.
export function bpCategory(sys: number, dia: number): { label: string; color: string } {
  if (sys >= 180 || dia >= 110) return { label: 'HTA grado 3', color: '#EF4444' }
  if (sys >= 160 || dia >= 100) return { label: 'HTA grado 2', color: '#F97316' }
  if (sys >= 140 || dia >= 90) return { label: 'HTA grado 1', color: '#F59E0B' }
  if (sys >= 130 || dia >= 85) return { label: 'Normal-alta', color: '#84CC16' }
  if (sys >= 120 && dia < 80) return { label: 'Normal', color: '#22C55E' }
  if (sys < 90 || dia < 60) return { label: 'Baja', color: '#3B82F6' }
  return { label: 'Óptima', color: '#22C55E' }
}

export function bluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

// ── Viatom / Lepu (Checkme BP2, BP2A) ───────────────────────────────────────

const VIATOM_SERVICE = '14839ac4-7d7e-415c-9a42-167340cf2339'
const VIATOM_WRITE = '8b00ace7-eb0b-49b0-bbe9-9aee0a26e1a3'
const VIATOM_NOTIFY = '0734594a-a8e7-4b1a-a6b1-cd5243059a57'
const LEPU_CMD_RT_DATA = 0x08

// CRC-8 (poly 0x07), tabla igual que BleCRC.java del SDK de Viatom
const CRC8_TABLE = (() => {
  const t = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let b = 0; b < 8; b++) c = (c & 0x80) ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff
    t[i] = c
  }
  return t
})()

function crc8(bytes: Uint8Array, end: number): number {
  let crc = 0
  for (let i = 0; i < end; i++) crc = CRC8_TABLE[(crc ^ bytes[i]) & 0xff]
  return crc
}

let lepuSeq = 0
function lepuCmd(cmd: number, data: Uint8Array = new Uint8Array(0)): Uint8Array {
  const len = data.length
  const buf = new Uint8Array(8 + len)
  buf[0] = 0xa5
  buf[1] = cmd
  buf[2] = ~cmd & 0xff
  buf[3] = 0x00
  buf[4] = lepuSeq
  buf[5] = len & 0xff
  buf[6] = (len >> 8) & 0xff
  buf.set(data, 7)
  buf[7 + len] = crc8(buf, 7 + len)
  lepuSeq = (lepuSeq + 1) % 255
  return buf
}

function u16le(b: Uint8Array, i: number): number { return b[i] | (b[i + 1] << 8) }

interface LepuFrame { cmd: number; data: Uint8Array }

// Acumula notificaciones y extrae tramas completas (pueden llegar troceadas).
class LepuFrameBuffer {
  private pool: number[] = []
  push(chunk: Uint8Array): LepuFrame[] {
    this.pool.push(...chunk)
    const frames: LepuFrame[] = []
    for (;;) {
      // buscar cabecera plausible: [head, cmd, ~cmd]
      let start = -1
      for (let i = 0; i + 2 < this.pool.length; i++) {
        const head = this.pool[i]
        if ((head === 0xa5 || head === 0x55) && (this.pool[i + 1] ^ this.pool[i + 2]) === 0xff) { start = i; break }
      }
      if (start < 0) { if (this.pool.length > 512) this.pool = []; break }
      if (start > 0) this.pool.splice(0, start)
      if (this.pool.length < 8) break
      const len = this.pool[5] | (this.pool[6] << 8)
      const total = 8 + len
      if (this.pool.length < total) break
      const frame = Uint8Array.from(this.pool.slice(0, total))
      this.pool.splice(0, total)
      if (crc8(frame, total - 1) === frame[total - 1]) {
        frames.push({ cmd: frame[1], data: frame.subarray(7, 7 + len) })
      }
    }
    return frames
  }
}

// RtData → resultado de tensión si la trama trae type=BpResult (0x01)
function parseLepuRtData(data: Uint8Array): { result?: BpReading; progress?: BpProgress } {
  if (data.length < 10) return {}
  // RtParam: status(1) batState(1) batLevel(1) batVol(2) reserva(4) = 9 bytes
  const wave = data.subarray(9)
  if (wave.length < 21) return {}
  const type = wave[0]
  const d = wave.subarray(1)
  if (type === 0x01) {
    // BpResult
    const sys = u16le(d, 3), dia = u16le(d, 5), pulse = u16le(d, 9)
    if (sys > 0 && dia > 0) return { result: { sys, dia, pulse: pulse || undefined, source: 'ble-checkme' } }
    return {}
  }
  if (type === 0x00) {
    // Bping: midiendo — presión actual del manguito
    const pressure = u16le(d, 1)
    return { progress: { phase: 'midiendo', pressure, message: `Midiendo… ${pressure} mmHg` } }
  }
  return {}
}

// ── GATT estándar (0x1810) ──────────────────────────────────────────────────

// IEEE-11073 SFLOAT (16 bit, little-endian)
function sfloat(b: DataView, i: number): number {
  const raw = b.getUint16(i, true)
  let mantissa = raw & 0x0fff
  if (mantissa >= 0x0800) mantissa -= 0x1000
  let exp = raw >> 12
  if (exp >= 0x8) exp -= 0x10
  return mantissa * Math.pow(10, exp)
}

function parseStandardBpm(v: DataView): BpReading | null {
  if (v.byteLength < 7) return null
  const flags = v.getUint8(0)
  const sys = sfloat(v, 1), dia = sfloat(v, 3)
  if (!isFinite(sys) || !isFinite(dia) || sys <= 0 || dia <= 0) return null
  let i = 7 // flags(1) + sys(2) + dia(2) + MAP(2)
  if (flags & 0x02) i += 7 // timestamp
  const pulse = (flags & 0x04) && v.byteLength >= i + 2 ? sfloat(v, i) : undefined
  return { sys: Math.round(sys), dia: Math.round(dia), pulse: pulse ? Math.round(pulse) : undefined, source: 'ble-estandar' }
}

// ── Lectura principal ───────────────────────────────────────────────────────

/**
 * Abre el selector Bluetooth, se conecta al tensiómetro y resuelve con la
 * primera lectura completa. El usuario inicia la medición en el aparato.
 * Lanza Error con mensaje legible si algo falla o el usuario cancela.
 */
export async function readBloodPressure(
  onProgress: (p: BpProgress) => void,
  opts: { anyDevice?: boolean; timeoutMs?: number } = {},
): Promise<BpReading> {
  const { anyDevice = false, timeoutMs = 180_000 } = opts
  if (!bluetoothAvailable()) {
    throw new Error('Este navegador no soporta Web Bluetooth. Úsalo en Chrome (Android/escritorio) o registra la lectura a mano.')
  }
  const bt = (navigator as any).bluetooth
  // Muchos tensiómetros no anuncian el UUID del servicio (ni el nombre esperado)
  // en el advertisement → si el filtrado no lo encuentra, `anyDevice` lista TODO
  // lo cercano y el usuario elige; el servicio correcto se detecta al conectar.
  const request = anyDevice
    ? { acceptAllDevices: true, optionalServices: [VIATOM_SERVICE, 'blood_pressure'] }
    : {
        filters: [
          { services: [VIATOM_SERVICE] },        // Checkme / Viatom / Wellue
          { services: ['blood_pressure'] },      // perfil estándar
          { namePrefix: 'BP2' }, { namePrefix: 'Checkme' }, { namePrefix: 'BP' },
          { namePrefix: 'LP' }, { namePrefix: 'Viatom' }, { namePrefix: 'Wellue' },
          { namePrefix: 'AirBP' },
        ],
        optionalServices: [VIATOM_SERVICE, 'blood_pressure'],
      }
  const device = await bt.requestDevice(request).catch(() => { throw new Error('Selección cancelada') })

  onProgress({ phase: 'conectando', message: `Conectando con ${device.name ?? 'el tensiómetro'}…` })
  const server = await device.gatt.connect()

  const cleanup = () => { try { device.gatt?.disconnect() } catch { /* ya desconectado */ } }

  try {
    return await new Promise<BpReading>((resolve, reject) => {
      let stopPoll: (() => void) | undefined
      const timer = setTimeout(() => fail(new Error('Tiempo agotado: no llegó ninguna medición. Haz la medición en el aparato con la app conectada.')), timeoutMs)
      const done = (r: BpReading) => { clearTimeout(timer); stopPoll?.(); resolve(r) }
      function fail(e: Error) { clearTimeout(timer); stopPoll?.(); reject(e) }

      ;(async () => {
        // 1) Perfil estándar
        const std = await server.getPrimaryService('blood_pressure').catch(() => null)
        if (std) {
          const ch = await std.getCharacteristic('blood_pressure_measurement')
          ch.addEventListener('characteristicvaluechanged', (e: any) => {
            try {
              const r = parseStandardBpm(e.target.value)
              if (r) done(r)
            } catch { /* paquete malformado: se ignora y se espera el siguiente */ }
          })
          await ch.startNotifications()
          onProgress({ phase: 'midiendo', message: 'Conectado. Inicia la medición en el tensiómetro.' })
          return
        }
        // 2) Checkme / Viatom
        const svc = await server.getPrimaryService(VIATOM_SERVICE).catch(() => null)
        if (!svc) throw new Error('El dispositivo no expone un servicio de tensión conocido.')
        const notify = await svc.getCharacteristic(VIATOM_NOTIFY)
        const write = await svc.getCharacteristic(VIATOM_WRITE)
        const frames = new LepuFrameBuffer()
        notify.addEventListener('characteristicvaluechanged', (e: any) => {
          const chunk = new Uint8Array(e.target.value.buffer)
          for (const f of frames.push(chunk)) {
            if (f.cmd !== LEPU_CMD_RT_DATA) continue
            const { result, progress } = parseLepuRtData(f.data)
            if (result) done(result)
            else if (progress) onProgress(progress)
          }
        })
        await notify.startNotifications()
        onProgress({ phase: 'midiendo', message: 'Conectado al Checkme. Inicia la medición en el aparato.' })
        // sondeo de datos en tiempo real (como el RtTask del SDK oficial: cada 500 ms)
        const poll = setInterval(async () => {
          try {
            await write.writeValueWithoutResponse(lepuCmd(LEPU_CMD_RT_DATA))
          } catch { /* desconexión: el timeout global lo captura */ }
        }, 500)
        stopPoll = () => clearInterval(poll)
        device.addEventListener('gattserverdisconnected', () => clearInterval(poll), { once: true })
      })().catch(fail)
    })
  } finally {
    cleanup()
  }
}
