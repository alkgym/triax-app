// useWorkoutSession — single source of truth for the gym tracker.
//
// Guarantees:
//   1. Every SetLog has a stable `uuid`. Cursors / editors reference rows by uuid only.
//   2. Sets are bound to templates by `templateId`, not by name. Renaming or reordering
//      a template never causes data loss or cross-contamination.
//   3. All writes that mutate multiple rows live inside a Dexie transaction → atomic.
//   4. The "ensure session + sync sets" effect is idempotent: counting + filling missing
//      rows happens inside a transaction, so concurrent renders cannot duplicate sets.

import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo } from 'react'
import { db, type ExerciseTemplate, type SetLog, type WorkoutSession, type WorkoutType } from '../db/schema'
import { newUuid } from '../lib/uuid'

export interface ExerciseBlock {
  templateId: number
  blockUuid: string         // derived stable id for React keys at the exercise level
  name: string
  order: number
  reps: string
  rir?: string
  pesoUnidad?: 'kg' | 'bw'
  pesoSugerido?: number
  notas?: string
  series: number
  setRows: SetLog[]         // sorted by setNumber, every row has uuid + templateId
}

export interface WorkoutSessionState {
  ready: boolean
  session: WorkoutSession | null
  templates: ExerciseTemplate[]
  blocks: ExerciseBlock[]
  flatSets: SetLog[]        // ordered: by template.order, then setNumber
  /** Update a row by uuid. Always atomic. */
  updateSet: (uuid: string, patch: Partial<SetLog>) => Promise<void>
  /** Toggle / set completion by uuid. */
  setCompleted: (uuid: string, completed: boolean) => Promise<void>
  /** Add an extra set to a template at end. setNumber auto-assigned inside a tx. */
  addExtraSet: (templateId: number) => Promise<string | null>
  /** Delete a single set by uuid. */
  deleteSet: (uuid: string) => Promise<void>
}

const GYM_TYPES: WorkoutType[] = ['push', 'pull', 'fullbody', 'legs', 'torso']

export function isGymType(type: WorkoutType): boolean {
  return GYM_TYPES.includes(type)
}

export function useWorkoutSession(date: string, workoutType: WorkoutType): WorkoutSessionState {
  const session = useLiveQuery(
    () => db.sessions.where('date').equals(date).filter(s => !s.isExtra).first() ?? null,
    [date]
  ) as WorkoutSession | null | undefined

  const templates = useLiveQuery(
    () => db.exerciseTemplates.where('type').equals(workoutType).and(t => t.active).toArray(),
    [workoutType]
  )

  const sets = useLiveQuery(
    async () => {
      if (!session?.id) return [] as SetLog[]
      return db.sets.where('sessionId').equals(session.id).toArray()
    },
    [session?.id]
  )

  // ── Idempotent session+sets sync ────────────────────────────────────────────
  // Single transaction ensures no parallel renders can duplicate set rows.
  useEffect(() => {
    if (!templates) return
    void ensureSessionAndSync(date, workoutType, templates)
  }, [templates, date, workoutType])

  // ── Derived view ────────────────────────────────────────────────────────────
  const blocks: ExerciseBlock[] = useMemo(() => {
    if (!templates || !sets) return []
    const sortedTpl = [...templates].sort((a, b) => a.order - b.order)
    return sortedTpl.map(t => {
      const rows = sets
        .filter(s => s.templateId === t.id || (s.templateId == null && s.exercise === t.name))
        .sort((a, b) => a.setNumber - b.setNumber)
      return {
        templateId: t.id!,
        blockUuid: `tpl-${t.id}`,
        name: t.name,
        order: t.order,
        reps: t.reps,
        rir: t.rir,
        pesoUnidad: t.pesoUnidad,
        pesoSugerido: t.pesoSugerido,
        notas: t.notas,
        series: t.series,
        setRows: rows,
      }
    })
  }, [templates, sets])

  const flatSets: SetLog[] = useMemo(() => blocks.flatMap(b => b.setRows), [blocks])

  // ── Mutations: by uuid only ────────────────────────────────────────────────
  const updateSet = useCallback(async (uuid: string, patch: Partial<SetLog>) => {
    if (!uuid) return
    const target = await db.sets.where('uuid').equals(uuid).first()
    if (!target?.id) return
    // Defensive: never let a caller change the uuid / sessionId / templateId
    // by accident — those are identity, not data.
    const safe: Partial<SetLog> = { ...patch }
    delete safe.uuid
    delete safe.sessionId
    delete safe.id
    await db.sets.update(target.id, safe)
  }, [])

  const setCompleted = useCallback(async (uuid: string, completed: boolean) => {
    return updateSet(uuid, { completed })
  }, [updateSet])

  const addExtraSet = useCallback(async (templateId: number): Promise<string | null> => {
    if (!session?.id) return null
    const tpl = templates?.find(t => t.id === templateId)
    if (!tpl) return null
    let createdUuid: string | null = null
    await db.transaction('rw', db.sets, async () => {
      const existing = await db.sets
        .where('sessionId').equals(session.id!)
        .and(s => s.templateId === templateId || (s.templateId == null && s.exercise === tpl.name))
        .toArray()
      const nextSetNumber = existing.reduce((m, s) => Math.max(m, s.setNumber), 0) + 1
      const last = existing.sort((a, b) => b.setNumber - a.setNumber)[0]
      createdUuid = newUuid()
      await db.sets.add({
        uuid: createdUuid,
        sessionId: session.id!,
        templateId,
        exercise: tpl.name,
        exerciseOrder: tpl.order,
        setNumber: nextSetNumber,
        weight: last?.weight ?? tpl.pesoSugerido,
        completed: false,
      })
    })
    return createdUuid
  }, [session?.id, templates])

  const deleteSet = useCallback(async (uuid: string) => {
    const target = await db.sets.where('uuid').equals(uuid).first()
    if (target?.id != null) await db.sets.delete(target.id)
  }, [])

  return {
    ready: !!templates && !!sets,
    session: session ?? null,
    templates: templates ?? [],
    blocks,
    flatSets,
    updateSet,
    setCompleted,
    addExtraSet,
    deleteSet,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

async function ensureSessionAndSync(
  date: string,
  workoutType: WorkoutType,
  templates: ExerciseTemplate[],
): Promise<void> {
  await db.transaction('rw', db.sessions, db.sets, async () => {
    // Fetch / create session
    let session = await db.sessions
      .where('date').equals(date).filter(s => !s.isExtra).first()
    if (!session) {
      const id = await db.sessions.add({
        date, type: workoutType, startedAt: Date.now(), notes: '', isExtra: false,
      })
      session = await db.sessions.get(id) ?? null as any
    }
    if (!session?.id) return

    // Fetch existing rows ONCE inside the tx (no race window).
    const existing = await db.sets.where('sessionId').equals(session.id).toArray()

    // Group by templateId (canonical), with a fallback bucket for legacy rows that
    // only have an exercise-name match — we'll adopt those into a templateId here.
    const byTplId = new Map<number, SetLog[]>()
    const byName = new Map<string, SetLog[]>()
    for (const s of existing) {
      if (s.templateId != null) {
        const arr = byTplId.get(s.templateId) ?? []; arr.push(s); byTplId.set(s.templateId, arr)
      } else {
        const arr = byName.get(s.exercise) ?? []; arr.push(s); byName.set(s.exercise, arr)
      }
    }

    const toAdd: Omit<SetLog, 'id'>[] = []

    for (const t of templates.filter(x => x.active)) {
      // 1) Adopt legacy name-keyed rows → bind them to this templateId for life.
      const orphans = byName.get(t.name)
      if (orphans?.length) {
        for (const o of orphans) {
          await db.sets.update(o.id!, {
            templateId: t.id,
            exerciseOrder: t.order,
            uuid: o.uuid ?? newUuid(),
          })
        }
        // Move into the templateId bucket
        const merged = (byTplId.get(t.id!) ?? []).concat(orphans)
        byTplId.set(t.id!, merged)
        byName.delete(t.name)
      }

      // 2) Cascade rename / reorder onto rows that already have templateId.
      const rows = byTplId.get(t.id!) ?? []
      for (const r of rows) {
        const patch: Partial<SetLog> = {}
        if (r.exercise !== t.name) patch.exercise = t.name
        if (r.exerciseOrder !== t.order) patch.exerciseOrder = t.order
        if (!r.uuid) patch.uuid = newUuid()
        if (Object.keys(patch).length > 0) await db.sets.update(r.id!, patch)
      }

      // 3) Fill missing planned series.
      const have = rows.length
      if (have < t.series) {
        for (let i = have + 1; i <= t.series; i++) {
          toAdd.push({
            uuid: newUuid(),
            sessionId: session.id,
            templateId: t.id,
            exercise: t.name,
            exerciseOrder: t.order,
            setNumber: i,
            reps: undefined,
            weight: t.pesoSugerido,
            completed: false,
          })
        }
      }
    }

    if (toAdd.length > 0) {
      await db.sets.bulkAdd(toAdd as SetLog[])
    }
  })
}
