import { db } from '../db/schema'
import { todayIso } from './dates'
import { TYPE_META } from './types'

const MESSAGES: Record<string, string> = {
  push: '💪 Push day. Pecho · hombro · tríceps. Vamos a por el press banca.',
  pull: '🔙 Pull day. Espalda y tracción. Antes, técnica de nado AM.',
  fullbody: '⚡ Full body. Unilateral, core y potencia. La transferencia al tri se gana hoy.',
  swim: '🏊 Día de nado. Técnica antes que velocidad. Caderas arriba.',
  bike: '🚴 Bici. Cadencia 85-95 RPM. Mantén Z2.',
  run: '🏃 Carrera. Pliométricos primero. Cuida la cadencia.',
  brick: '⚡ BRICK. Bici → carrera. El choque neurovascular se entrena.',
  rest: '🧘 Descanso activo. Foam roller + movilidad 20 min.',
}

export async function requestNotifPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  return await Notification.requestPermission()
}

export async function scheduleTodayReminder() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const today = todayIso()
  const plan = await db.planDays.where('date').equals(today).first()
  if (!plan) return
  const now = new Date()
  const target = new Date()
  target.setHours(16, 45, 0, 0)
  const ms = target.getTime() - now.getTime()
  if (ms < 0) return // already past 16:45
  const meta = TYPE_META[plan.type]
  setTimeout(() => {
    try {
      new Notification(`${meta.emoji} ${meta.label} · ${plan.title}`, {
        body: MESSAGES[plan.type] ?? plan.description,
        icon: '/icon.svg',
        tag: 'tri-reminder',
        badge: '/icon.svg',
      })
    } catch {}
  }, ms)
}
