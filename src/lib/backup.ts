// Backup unificado — única fuente de verdad sobre qué contiene un volcado completo.
// Lo usan la exportación de Progreso, la de Ajustes, la importación y el auto-backup:
// añadir una tabla nueva aquí la incluye en los cuatro sitios a la vez.

import { db } from '../db/schema'
import { todayIso } from './dates'

export const BACKUP_TABLES = [
  'profile', 'exerciseTemplates', 'planDays', 'sessions', 'sets',
  'bodyMetrics', 'prs', 'nutrition', 'gear', 'painLogs',
  'rehabExercises', 'schedule', 'bpLogs',
] as const

export type BackupTable = typeof BACKUP_TABLES[number]

export interface BackupDump {
  exportedAt: string
  ts: number
  tables: Partial<Record<BackupTable, unknown[]>>
}

// Formato plano (legacy + actual): las tablas van en la raíz del objeto.
// Se mantiene así para que los backups antiguos sigan siendo importables.
export async function dumpAll(): Promise<Record<string, unknown>> {
  const dump: Record<string, unknown> = { exportedAt: todayIso(), ts: Date.now() }
  await Promise.all(BACKUP_TABLES.map(async t => { dump[t] = await db.table(t).toArray() }))
  return dump
}

export async function downloadBackup(): Promise<void> {
  const dump = await dumpAll()
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gym-backup-${dump.exportedAt}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Restaura un volcado. Solo se reemplazan las tablas presentes en el archivo
 * (con al menos una fila); todo dentro de UNA transacción, así un archivo
 * corrupto no puede dejar la base de datos a medias.
 *
 * Los ids originales se conservan (bulkPut): sets.sessionId y sets.templateId
 * siguen apuntando a la sesión/plantilla correcta tras restaurar.
 */
export async function restoreBackup(dump: unknown): Promise<BackupTable[]> {
  if (!dump || typeof dump !== 'object') throw new Error('Formato de backup no válido')
  const d = dump as Record<string, unknown>
  const present = BACKUP_TABLES.filter(t => Array.isArray(d[t]) && (d[t] as unknown[]).length > 0)
  if (present.length === 0) throw new Error('El archivo no contiene datos')

  // Red de seguridad: instantánea del estado actual ANTES de tocar nada,
  // para poder recuperar los datos si el backup importado no era el bueno.
  try {
    const pre = await dumpAll()
    localStorage.setItem('triax.prerestore', JSON.stringify(pre))
  } catch { /* sin hueco en localStorage: seguimos, la restauración sigue siendo atómica */ }

  await db.transaction('rw', present.map(t => db.table(t)), async () => {
    for (const t of present) {
      const rows = d[t] as Record<string, unknown>[]
      await db.table(t).clear()
      await db.table(t).bulkPut(rows)
    }
  })
  return present
}
