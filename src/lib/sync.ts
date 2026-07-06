// ─────────────────────────────────────────────────────────────────────────
// sync.ts — sincronización del estado completo de la app con la VPS.
//
// El servidor (triax-sync, tras el gate de auth en /api) guarda un snapshot
// JSON de todas las tablas. Política: last-write-wins por timestamp, con
// versiones en el servidor como red de seguridad.
//
// SEGURIDAD DE DATOS:
//  • Si este dispositivo ya tiene datos y nunca ha sincronizado, la PRIMERA
//    sync SUBE (push) — nunca baja algo que los pisaría.
//  • Bajar/restaurar son siempre acciones manuales.
//  • El rastreador de cambios vive como middleware de Dexie registrado ANTES
//    de abrir la BD (ver db/schema.ts). El bug de junio-2026 era registrarlo
//    después de abrir: no enganchaba nada y `localModified` quedó congelado →
//    el auto-sync decía "todo sincronizado" para siempre.
// ─────────────────────────────────────────────────────────────────────────
import { db, setDirtyHook } from '../db/schema'
import { BACKUP_TABLES } from './backup'

const API = '/api/snapshot'
const K_MODIFIED = 'triax.sync.localModified' // ms de la última mutación local
const K_SYNCED = 'triax.sync.syncedAt'        // server.updatedAt reconciliado por última vez
const K_AUTO = 'triax.sync.auto'              // '1' | '0'
const K_RESULT = 'triax.sync.lastResult'      // JSON SyncResult

// Se sincroniza exactamente lo mismo que entra en un backup (bpLogs incluido).
const TABLES = BACKUP_TABLES

const PUSH_DEBOUNCE_MS = 5_000

let applying = false   // true mientras aplicamos un snapshot bajado (no marcar dirty)
let installed = false
let inFlight = false
let pushTimer: number | undefined

// ── estado local ──────────────────────────────────────────────────────────
export function markLocalModified() {
  if (applying) return
  try { localStorage.setItem(K_MODIFIED, String(Date.now())) } catch { /* quota */ }
  // Guardado local → subida automática (debounced) si el auto-sync está activo.
  if (isAutoSync() && typeof window !== 'undefined') {
    window.clearTimeout(pushTimer)
    pushTimer = window.setTimeout(() => { autoSync().catch(() => {}) }, PUSH_DEBOUNCE_MS)
  }
}
function num(k: string): number { return Number(localStorage.getItem(k) || '0') }
function setNum(k: string, v: number) { try { localStorage.setItem(k, String(v)) } catch { /* quota */ } }

export function isAutoSync(): boolean { return (localStorage.getItem(K_AUTO) ?? '1') === '1' }
export function setAutoSync(on: boolean) { try { localStorage.setItem(K_AUTO, on ? '1' : '0') } catch { /* */ } }

export interface SyncResult { ok: boolean; kind: 'push' | 'pull' | 'noop' | 'error'; message: string; at: number }
function record(r: SyncResult): SyncResult { try { localStorage.setItem(K_RESULT, JSON.stringify(r)) } catch { /* */ } return r }
export function lastResult(): SyncResult | null {
  try { const r = localStorage.getItem(K_RESULT); return r ? JSON.parse(r) as SyncResult : null } catch { return null }
}

// ── tracker de cambios ───────────────────────────────────────────────────────
// El middleware de Dexie ya está registrado en db/schema.ts (antes de abrir la
// BD). Aquí solo conectamos su callback; hasta entonces las mutaciones (p. ej.
// el sembrado inicial) NO cuentan como cambios de usuario.
export function installSyncTracker() {
  if (installed) return
  installed = true
  setDirtyHook(markLocalModified)
}

// Inicializa el estado de sync una sola vez.
//   • Si el dispositivo tiene datos DE USUARIO reales (sesiones, series, dolores,
//     pesajes, PRs, nutrición, tensión) y nunca ha sincronizado → se marca
//     "modificado" para que SUBA primero (protege el móvil con datos).
//   • Si solo tiene datos sembrados por defecto → se deja en 0 para que BAJE
//     lo del servidor (evita que un dispositivo nuevo pise los datos buenos).
// Debe llamarse ANTES de installSyncTracker, para que el sembrado no cuente.
export async function initSyncState() {
  if (localStorage.getItem(K_MODIFIED) != null) return
  setNum(K_MODIFIED, (await hasUserData()) ? Date.now() : 0)
}

// ── snapshot ────────────────────────────────────────────────────────────────
async function buildSnapshot(): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {}
  await db.transaction('r', db.tables, async () => {
    for (const t of db.tables) {
      if ((TABLES as readonly string[]).includes(t.name)) out[t.name] = await t.toArray()
    }
  })
  return out
}

async function applySnapshot(payload: Record<string, unknown[]>) {
  applying = true
  try {
    await db.transaction('rw', db.tables, async () => {
      for (const t of db.tables) {
        const rows = payload[t.name]
        if (Array.isArray(rows)) {
          await t.clear()
          if (rows.length) await t.bulkPut(rows as never[])
        }
      }
    })
  } finally {
    applying = false
  }
}

// ── transporte ───────────────────────────────────────────────────────────────
interface ServerSnapshot { updatedAt: number | null; serverAt: number | null; payload: Record<string, unknown[]> | null }

async function serverGet(): Promise<ServerSnapshot> {
  const r = await fetch(API, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
  if (!r.ok) throw new Error('GET ' + r.status)
  return r.json() as Promise<ServerSnapshot>
}
async function serverPut(updatedAt: number, payload: Record<string, unknown[]>, force: boolean): Promise<{ updatedAt: number }> {
  const r = await fetch(API + (force ? '?force=1' : ''), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ updatedAt, payload }),
  })
  if (!r.ok) throw new Error('PUT ' + r.status)
  return r.json() as Promise<{ updatedAt: number }>
}

// ── acciones públicas ─────────────────────────────────────────────────────────
// El snapshot que se sube ES el estado actual → updatedAt = ahora (no el
// marcador local, que describe cuándo fue el último cambio, no la versión).
export async function pushNow(force = false): Promise<SyncResult> {
  const at = Date.now()
  try {
    const payload = await buildSnapshot()
    const res = await serverPut(at, payload, force)
    setNum(K_SYNCED, res.updatedAt)
    setNum(K_MODIFIED, res.updatedAt)
    return record({ ok: true, kind: 'push', message: 'Datos subidos a la VPS', at })
  } catch (e) {
    return record({ ok: false, kind: 'error', message: 'Error al subir: ' + msg(e), at })
  }
}

export async function pullNow(): Promise<SyncResult> {
  const at = Date.now()
  try {
    const srv = await serverGet()
    if (!srv.updatedAt || !srv.payload) return record({ ok: true, kind: 'noop', message: 'No hay datos en la VPS todavía', at })
    await applySnapshot(srv.payload)
    setNum(K_SYNCED, srv.updatedAt)
    setNum(K_MODIFIED, srv.updatedAt)
    return record({ ok: true, kind: 'pull', message: 'Datos descargados de la VPS', at })
  } catch (e) {
    return record({ ok: false, kind: 'error', message: 'Error al bajar: ' + msg(e), at })
  }
}

// ¿Tiene este dispositivo datos DE USUARIO reales (no solo sembrado)?
async function hasUserData(): Promise<boolean> {
  try {
    const counts = await Promise.all([
      db.sessions.count(), db.sets.count(), db.painLogs.count(),
      db.bodyMetrics.count(), db.prs.count(), db.nutrition.count(), db.bpLogs.count(),
    ])
    return counts.reduce((a, b) => a + b, 0) > 0
  } catch { return false }
}

// Sincronización automática SEGURA: solo SUBE o no hace nada. NUNCA baja/pisa
// automáticamente un dispositivo que ya tiene datos de usuario (eso provocó la
// pérdida anterior). Bajar es siempre una acción manual y deliberada (botón
// "Bajar de la VPS" o restaurar una versión).
export async function autoSync(): Promise<SyncResult> {
  if (inFlight) return record({ ok: true, kind: 'noop', message: 'sync en curso', at: Date.now() })
  inFlight = true
  try {
    const srv = await serverGet()
    const localMod = num(K_MODIFIED)
    const syncedAt = num(K_SYNCED)
    const mine = await hasUserData()

    // Servidor vacío: si tengo datos, los subo (protege el dispositivo con datos).
    if (!srv.updatedAt || !srv.payload) {
      if (mine) return await pushNow()
      return record({ ok: true, kind: 'noop', message: 'Servidor vacío', at: Date.now() })
    }

    // Tengo cambios locales sin subir → subir.
    if (localMod > syncedAt) return await pushNow()

    // El servidor está por delante y yo no tengo cambios pendientes:
    //   • Si NO tengo datos de usuario (dispositivo nuevo/vacío) → bajar es seguro.
    //   • Si SÍ tengo datos → NO bajo solo; aviso para que el usuario decida.
    if (srv.updatedAt !== syncedAt) {
      if (!mine) {
        await applySnapshot(srv.payload)
        setNum(K_SYNCED, srv.updatedAt)
        setNum(K_MODIFIED, srv.updatedAt)
        return record({ ok: true, kind: 'pull', message: 'Datos descargados de la VPS', at: Date.now() })
      }
      return record({ ok: true, kind: 'noop', message: 'Hay una versión más nueva en la VPS — usa «Bajar» o «Versiones» si quieres traerla', at: Date.now() })
    }

    return record({ ok: true, kind: 'noop', message: 'Todo sincronizado', at: Date.now() })
  } catch (e) {
    return record({ ok: false, kind: 'error', message: 'Sync falló: ' + msg(e), at: Date.now() })
  } finally {
    inFlight = false
  }
}

export interface VersionInfo { serverAt: number; updatedAt: number; sizeKb: number; userRecords?: number; canonical?: boolean }

// Lista las versiones guardadas en la VPS (red de seguridad / rollback).
export async function listVersions(): Promise<VersionInfo[]> {
  try {
    const r = await fetch('/api/history', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    if (!r.ok) return []
    const j = await r.json() as { versions?: VersionInfo[] }
    return j.versions ?? []
  } catch { return [] }
}

// Restaura una versión concreta en ESTE dispositivo y la marca como actual
// (al sincronizar pasará a ser la última en la VPS).
export async function restoreVersion(serverAt: number): Promise<SyncResult> {
  const at = Date.now()
  try {
    const r = await fetch('/api/snapshot?at=' + serverAt, { credentials: 'same-origin' })
    if (!r.ok) throw new Error('GET ' + r.status)
    const srv = await r.json() as ServerSnapshot
    if (!srv.payload) return record({ ok: false, kind: 'error', message: 'Versión no encontrada', at })
    await applySnapshot(srv.payload)
    setNum(K_MODIFIED, Date.now())
    return record({ ok: true, kind: 'pull', message: 'Versión restaurada en este dispositivo', at })
  } catch (e) {
    return record({ ok: false, kind: 'error', message: 'Error al restaurar: ' + msg(e), at })
  }
}

export interface ServerInfo { updatedAt: number | null; serverAt: number | null; reachable: boolean }
export async function serverInfo(): Promise<ServerInfo> {
  try { const r = await serverGet(); return { updatedAt: r.updatedAt, serverAt: r.serverAt, reachable: true } }
  catch { return { updatedAt: null, serverAt: null, reachable: false } }
}

// Pide al navegador almacenamiento persistente (evita que iOS/Safari purgue IndexedDB).
export async function requestPersistentStorage(): Promise<boolean> {
  try { if (navigator.storage?.persist) return await navigator.storage.persist() } catch { /* */ }
  return false
}

function msg(e: unknown): string { return e instanceof Error ? e.message : String(e) }
