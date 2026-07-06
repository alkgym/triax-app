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
// Algunos Lepu hablan el mismo protocolo sobre Nordic UART o FFE0
const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
const NUS_WRITE = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'
const NUS_NOTIFY = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'
const FFE0_SERVICE = '0000ffe0-0000-1000-8000-00805f9b34fb'
const FFE1_CHAR = '0000ffe1-0000-1000-8000-00805f9b34fb'
// FFF0: muy común en tensiómetros white-label (Transtek y similares)
const FFF0_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb'
const FFF1_CHAR = '0000fff1-0000-1000-8000-00805f9b34fb'
const FFF2_CHAR = '0000fff2-0000-1000-8000-00805f9b34fb'
const BPS_SERVICE = '00001810-0000-1000-8000-00805f9b34fb'
const DIS_SERVICE = '0000180a-0000-1000-8000-00805f9b34fb'  // Device Information
const LEPU_CMD_RT_DATA = 0x08

function sig16(x: number): string { return `0000${x.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb` }

// Transtek/Lifesense (TMB-xxxx-BT, p. ej. TMB-2288-BT "BP3-C1"): servicio
// propietario 0x7889 con handshake de vinculación (contraseña + XOR + usuario).
// Protocolo según github.com/NecoHorne (Phulukisa BLE protocols).
const TRANSTEK_SERVICE = '00007889-0000-1000-8000-00805f9b34fb'
const TRANSTEK_WRITE = '00008a81-0000-1000-8000-00805f9b34fb'
const TRANSTEK_INDICATE = '00008a91-0000-1000-8000-00805f9b34fb'
const TRANSTEK_NOTIFY = '00008a92-0000-1000-8000-00805f9b34fb'
const K_TRANSTEK_PW = 'triax.bp.transtek.pw.'   // + device.id → hex de 4 bytes

// Lista base: lo que no esté declarado, Web Bluetooth ni siquiera nos deja verlo.
const CORE_SERVICES = [
  VIATOM_SERVICE, BPS_SERVICE, NUS_SERVICE, FFE0_SERVICE, FFF0_SERVICE, DIS_SERVICE,
  TRANSTEK_SERVICE, 'battery_service',
  sig16(0x1808), sig16(0x181b), sig16(0x181d), // glucosa · body composition · báscula (por si acaso)
  sig16(0xffe5), sig16(0xffb0), sig16(0xfee0), sig16(0xfee1), sig16(0xfff5),
  sig16(0x8a80), sig16(0xa600), sig16(0x7888), sig16(0x788a), // vecinos Transtek/Lifesense
]

// Barrido amplio de páginas 16-bit típicas de sanitarios y vendors (0x18xx,
// 0xFDxx-0xFFxx): garantiza que el servicio real del aparato sea VISIBLE en el
// diagnóstico aunque no lo conozcamos. Si Chrome rechazara la lista larga, el
// requestDevice cae a CORE_SERVICES automáticamente.
const CANDIDATE_SERVICES = (() => {
  const set = new Set<string>(CORE_SERVICES)
  for (let x = 0x1800; x <= 0x18ff; x++) set.add(sig16(x))
  for (let x = 0xfd00; x <= 0xffff; x++) set.add(sig16(x))
  return Array.from(set)
})()

function hexBytes(u: Uint8Array, max = 16): string {
  return Array.from(u.slice(0, max)).map(b => b.toString(16).padStart(2, '0')).join(' ')
}

// segundos desde 2010-01-01 00:00:00 (hora local), empaquetado little-endian
function transtekTimeCmd(): Uint8Array {
  const secs = Math.floor((Date.now() - new Date(2010, 0, 1).getTime()) / 1000)
  return new Uint8Array([0x02, secs & 0xff, (secs >> 8) & 0xff, (secs >> 16) & 0xff, (secs >>> 24) & 0xff])
}

const TRANSTEK_USER_CMD = new Uint8Array([0x03, 0x01, 0x41, 0x6e, 0x64, 0x72, 0x6f, 0x69, 0x64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])

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
    ? { acceptAllDevices: true, optionalServices: CANDIDATE_SERVICES }
    : {
        filters: [
          { services: [VIATOM_SERVICE] },        // Checkme / Viatom / Wellue
          { services: ['blood_pressure'] },      // perfil estándar
          { namePrefix: 'BP' }, { namePrefix: 'Checkme' }, { namePrefix: 'LP' },
          { namePrefix: 'Viatom' }, { namePrefix: 'Wellue' }, { namePrefix: 'AirBP' },
        ],
        optionalServices: CANDIDATE_SERVICES,
      }
  const device = await bt.requestDevice(request).catch(async (e: unknown) => {
    // Lista larga rechazada por el navegador → reintenta con la lista base
    if (e instanceof TypeError) {
      const fallback = anyDevice
        ? { acceptAllDevices: true, optionalServices: CORE_SERVICES }
        : { ...request, optionalServices: CORE_SERVICES }
      return bt.requestDevice(fallback).catch(() => { throw new Error('Selección cancelada') })
    }
    throw new Error('Selección cancelada')
  })

  onProgress({ phase: 'conectando', message: `Conectando con ${device.name ?? 'el tensiómetro'}…` })
  let server = await device.gatt.connect()

  const cleanup = () => { try { device.gatt?.disconnect() } catch { /* ya desconectado */ } }

  // Android tarda en descubrir servicios justo tras conectar (carrera GATT):
  // reintenta el descubrimiento y, si hace falta, reconecta una vez.
  async function discoverServices(): Promise<any[]> {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const list = await server.getPrimaryServices()
        if (list.length > 0) return list
      } catch { /* aún no descubiertos */ }
      onProgress({ phase: 'conectando', message: `Buscando servicios (${attempt}/4)…` })
      await new Promise(r => setTimeout(r, 800))
      if (!device.gatt.connected) {
        try { server = await device.gatt.connect() } catch { /* reintento siguiente */ }
      }
    }
    return []
  }

  try {
    return await new Promise<BpReading>((resolve, reject) => {
      let stopPoll: (() => void) | undefined
      const timer = setTimeout(() => fail(new Error('Tiempo agotado: no llegó ninguna medición. Haz la medición en el aparato con la app conectada.')), timeoutMs)
      const done = (r: BpReading) => { clearTimeout(timer); stopPoll?.(); resolve(r) }
      function fail(e: Error) { clearTimeout(timer); stopPoll?.(); reject(e) }

      ;(async () => {
        const services = await discoverServices()
        const uuids = new Set(services.map((s: any) => String(s.uuid).toLowerCase()))

        // 1) Perfil GATT estándar — puede requerir emparejamiento del sistema,
        // y al conectar suele volcar TODAS las lecturas memorizadas: esperamos
        // un respiro tras la última y guardamos la más reciente.
        if (uuids.has(BPS_SERVICE)) {
          const std = services.find((s: any) => String(s.uuid).toLowerCase() === BPS_SERVICE)
          const ch = await std.getCharacteristic('blood_pressure_measurement')
          let lastReading: BpReading | null = null
          let settleTimer: number | undefined
          ch.addEventListener('characteristicvaluechanged', (e: any) => {
            try {
              const r = parseStandardBpm(e.target.value)
              if (!r) return
              lastReading = r
              onProgress({ phase: 'midiendo', message: `Recibiendo lecturas… última ${r.sys}/${r.dia}` })
              window.clearTimeout(settleTimer)
              settleTimer = window.setTimeout(() => { if (lastReading) done(lastReading) }, 2200)
            } catch { /* paquete malformado: se ignora y se espera el siguiente */ }
          })
          onProgress({ phase: 'conectando', message: 'Activando lecturas… acepta el EMPAREJAMIENTO si el móvil lo pide.' })
          await ch.startNotifications()
          onProgress({ phase: 'midiendo', message: 'Conectado. Haz la medición (o enviará las memorizadas).' })
          return
        }

        // 2) Transtek/Lifesense (TMB-xxxx-BT) — handshake propietario 0x7889
        if (uuids.has(TRANSTEK_SERVICE)) {
          const svc = services.find((s: any) => String(s.uuid).toLowerCase() === TRANSTEK_SERVICE)
          const write = await svc.getCharacteristic(TRANSTEK_WRITE)
          const send = async (bytes: Uint8Array) => {
            if (write.properties?.writeWithoutResponse) await write.writeValueWithoutResponse(bytes)
            else await write.writeValue(bytes)
          }
          const pwKey = K_TRANSTEK_PW + (device.id ?? 'default')
          const storedPw = (localStorage.getItem(pwKey) ?? '').match(/.{2}/g)?.map(h => parseInt(h, 16))
          let password: number[] | null = storedPw && storedPw.length === 4 ? storedPw : null
          let bound = password != null

          const onFrame = async (data: Uint8Array) => {
            if (data.length === 0) return
            const cmd = data[0]
            if (cmd === 0xa0 && data.length >= 5) {
              // contraseña del aparato → guardar y (si es la primera vez) vincular
              password = [data[1], data[2], data[3], data[4]]
              try { localStorage.setItem(pwKey, password.map(b => b.toString(16).padStart(2, '0')).join('')) } catch { /* quota */ }
              if (!bound) {
                const rnd = crypto.getRandomValues(new Uint8Array(4))
                await send(new Uint8Array([0x21, rnd[0], rnd[1], rnd[2], rnd[3]]))
              }
              return
            }
            if (cmd === 0xa1 && data.length >= 5) {
              if (!password) { onProgress({ phase: 'conectando', message: 'El aparato pide verificación pero no hay contraseña — reintenta para vincular.' }); return }
              await send(new Uint8Array([0x20, password[0] ^ data[1], password[1] ^ data[2], password[2] ^ data[3], password[3] ^ data[4]]))
              await send(transtekTimeCmd())
              bound = true
              onProgress({ phase: 'midiendo', message: 'Vinculado con el tensiómetro. Haz la medición (o se descargará la última).' })
              return
            }
            if (cmd === 0x83) {
              await send(TRANSTEK_USER_CMD)
              return
            }
            // Trama de medición (según protocolo: sys u16le@1 · dia u16le@3 · pulso u16le@11)
            if (data.length >= 13) {
              const sys = u16le(data, 1), dia = u16le(data, 3), pulse = u16le(data, 11)
              if (sys >= 60 && sys <= 260 && dia >= 30 && dia <= 200 && dia < sys) {
                done({ sys, dia, pulse: pulse >= 25 && pulse <= 220 ? pulse : undefined, source: 'ble-checkme' })
                return
              }
            }
            // Desconocida → enséñala para poder afinar el protocolo a distancia
            onProgress({ phase: 'midiendo', message: `Trama no reconocida: ${hexBytes(data)} — pásame esto tal cual.` })
          }

          for (const charUuid of [TRANSTEK_INDICATE, TRANSTEK_NOTIFY]) {
            try {
              const ch = await svc.getCharacteristic(charUuid)
              ch.addEventListener('characteristicvaluechanged', (e: any) => {
                void onFrame(new Uint8Array(e.target.value.buffer)).catch(() => {})
              })
              await ch.startNotifications()
            } catch { /* alguna variante no expone ambas */ }
          }
          onProgress({ phase: 'midiendo', message: bound ? 'Conectado al tensiómetro. Haz la medición.' : 'Vinculando con el tensiómetro (primera vez)…' })
          return
        }

        // 3) Protocolo Lepu sobre el transporte que exponga el aparato
        let writeCh: any = null
        let notifyCh: any = null
        if (uuids.has(VIATOM_SERVICE)) {
          const svc = services.find((s: any) => String(s.uuid).toLowerCase() === VIATOM_SERVICE)
          notifyCh = await svc.getCharacteristic(VIATOM_NOTIFY)
          writeCh = await svc.getCharacteristic(VIATOM_WRITE)
        } else if (uuids.has(NUS_SERVICE)) {
          const svc = services.find((s: any) => String(s.uuid).toLowerCase() === NUS_SERVICE)
          notifyCh = await svc.getCharacteristic(NUS_NOTIFY)
          writeCh = await svc.getCharacteristic(NUS_WRITE)
        } else if (uuids.has(FFE0_SERVICE)) {
          const svc = services.find((s: any) => String(s.uuid).toLowerCase() === FFE0_SERVICE)
          notifyCh = await svc.getCharacteristic(FFE1_CHAR)
          writeCh = notifyCh
        } else if (uuids.has(FFF0_SERVICE)) {
          const svc = services.find((s: any) => String(s.uuid).toLowerCase() === FFF0_SERVICE)
          notifyCh = await svc.getCharacteristic(FFF1_CHAR)
          writeCh = await svc.getCharacteristic(FFF2_CHAR).catch(() => notifyCh)
        }

        if (!writeCh || !notifyCh) {
          const info = await readDeviceInfo(services)
          const seen = services.length
            ? `Servicios visibles: ${services.map((s: any) => shortUuid(String(s.uuid))).join(', ')}`
            : 'No se pudo descubrir ningún servicio (el aparato puede haber cortado la conexión — enciéndelo y reintenta enseguida)'
          throw new Error(`Sin servicio de tensión conocido. ${info ? info + ' · ' : ''}${seen}. Pásame esto y lo añado.`)
        }

        const frames = new LepuFrameBuffer()
        notifyCh.addEventListener('characteristicvaluechanged', (e: any) => {
          const chunk = new Uint8Array(e.target.value.buffer)
          for (const f of frames.push(chunk)) {
            if (f.cmd !== LEPU_CMD_RT_DATA) continue
            const { result, progress } = parseLepuRtData(f.data)
            if (result) done(result)
            else if (progress) onProgress(progress)
          }
        })
        await notifyCh.startNotifications()
        onProgress({ phase: 'midiendo', message: 'Conectado al Checkme. Inicia la medición en el aparato.' })
        // sondeo de datos en tiempo real (como el RtTask del SDK oficial: cada 500 ms)
        const canNoResp = !!writeCh.properties?.writeWithoutResponse
        const poll = setInterval(async () => {
          try {
            const cmd = lepuCmd(LEPU_CMD_RT_DATA)
            if (canNoResp) await writeCh.writeValueWithoutResponse(cmd)
            else await writeCh.writeValue(cmd)
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

function shortUuid(u: string): string {
  const m = u.match(/^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/i)
  return m ? `0x${m[1]}` : u
}

// Fabricante y modelo vía Device Information (0x180A) — identifica el aparato
// real aunque su servicio de tensión sea desconocido.
async function readDeviceInfo(services: any[]): Promise<string> {
  const dis = services.find((s: any) => String(s.uuid).toLowerCase() === DIS_SERVICE)
  if (!dis) return ''
  const read = async (name: string) => {
    try {
      const ch = await dis.getCharacteristic(name)
      const v = await ch.readValue()
      return new TextDecoder().decode(v.buffer).replace(/\0+$/, '').trim()
    } catch { return '' }
  }
  const [man, model] = await Promise.all([read('manufacturer_name_string'), read('model_number_string')])
  return [man, model].filter(Boolean).join(' ')
}
