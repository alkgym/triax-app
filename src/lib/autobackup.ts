// Auto-backup snapshot to localStorage. Runs on app start (cheap, async).
// Keeps the last 2 snapshots so a corrupted "current" can roll back to "previous".

import { db } from '../db/schema'
import { todayIso } from './dates'

const KEY_CURRENT = 'triax.autobackup.current'
const KEY_PREVIOUS = 'triax.autobackup.previous'
const KEY_LAST_AT = 'triax.autobackup.lastAt'
const INTERVAL_MS = 7 * 24 * 60 * 60 * 1000   // 7 days

export interface BackupSnapshot {
  exportedAt: string
  ts: number
  profile: any[]
  planDays: any[]
  exerciseTemplates: any[]
  sessions: any[]
  sets: any[]
  bodyMetrics: any[]
  prs: any[]
  nutrition: any[]
  gear: any[]
  painLogs?: any[]
}

async function snapshot(): Promise<BackupSnapshot> {
  const [profile, planDays, exerciseTemplates, sessions, sets, bodyMetrics, prs, nutrition, gear, painLogs] =
    await Promise.all([
      db.profile.toArray(), db.planDays.toArray(), db.exerciseTemplates.toArray(),
      db.sessions.toArray(), db.sets.toArray(), db.bodyMetrics.toArray(),
      db.prs.toArray(), db.nutrition.toArray(), db.gear.toArray(), db.painLogs.toArray(),
    ])
  return {
    exportedAt: todayIso(), ts: Date.now(),
    profile, planDays, exerciseTemplates, sessions, sets, bodyMetrics, prs, nutrition, gear, painLogs,
  }
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
    return { exportedAt: parsed.exportedAt, ts: parsed.ts, sizeKb: Math.round(raw.length / 1024) }
  } catch { return {} }
}

export function readLastBackup(): BackupSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY_CURRENT)
    return raw ? JSON.parse(raw) as BackupSnapshot : null
  } catch { return null }
}
