// Auto-backup snapshot to localStorage. Runs on app start (cheap, async).
// Keeps the last 2 snapshots so a corrupted "current" can roll back to "previous".

import { dumpAll } from './backup'

const KEY_CURRENT = 'triax.autobackup.current'
const KEY_PREVIOUS = 'triax.autobackup.previous'
const KEY_LAST_AT = 'triax.autobackup.lastAt'
const INTERVAL_MS = 7 * 24 * 60 * 60 * 1000   // 7 days

export type BackupSnapshot = Record<string, unknown>

async function snapshot(): Promise<BackupSnapshot> {
  return dumpAll()
}

export async function maybeAutoBackup(): Promise<void> {
  try {
    const lastAt = Number(localStorage.getItem(KEY_LAST_AT) ?? '0')
    if (Date.now() - lastAt < INTERVAL_MS) return
    const snap = await snapshot()
    const cur = localStorage.getItem(KEY_CURRENT)
    if (cur) {
      try { localStorage.setItem(KEY_PREVIOUS, cur) } catch {}
    }
    const json = JSON.stringify(snap)
    // Bail gracefully if quota exceeded — backups can be big
    try {
      localStorage.setItem(KEY_CURRENT, json)
      localStorage.setItem(KEY_LAST_AT, String(Date.now()))
    } catch {
      // Try clearing the previous one to make room
      try {
        localStorage.removeItem(KEY_PREVIOUS)
        localStorage.setItem(KEY_CURRENT, json)
        localStorage.setItem(KEY_LAST_AT, String(Date.now()))
      } catch {}
    }
  } catch {}
}

export function getLastBackupInfo(): { exportedAt?: string; ts?: number; sizeKb?: number } {
  try {
    const raw = localStorage.getItem(KEY_CURRENT)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as BackupSnapshot
    return { exportedAt: parsed.exportedAt as string | undefined, ts: parsed.ts as number | undefined, sizeKb: Math.round(raw.length / 1024) }
  } catch { return {} }
}

export function readLastBackup(): BackupSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY_CURRENT)
    return raw ? JSON.parse(raw) as BackupSnapshot : null
  } catch { return null }
}
