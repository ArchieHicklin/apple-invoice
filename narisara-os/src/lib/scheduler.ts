import type { AppState, Block, CalEvent, Task } from './types'
import { uid } from './types'
import { addDays, fromISO, toISO } from './dates'

// ── Deterministic weekly auto-scheduler ────────────────────────────
// Assigns each week's tasks to concrete times, seeded by the week so
// the same week always proposes the same plan (until the user reacts).

/** Small seeded PRNG (mulberry32) so a given week is stable. */
function rng(seedStr: string) {
  let h = 1779033703 ^ seedStr.length
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const GRID = 30 // minutes

interface Busy { day: number; start: number; end: number }

function collectBusy(state: AppState, weekISO: string, ignoreBlockId?: string): Busy[] {
  const busy: Busy[] = []
  for (const b of state.blocks) {
    if (b.weekOf !== weekISO || b.status === 'scrapped' || b.id === ignoreBlockId) continue
    busy.push({ day: b.day, start: b.start, end: b.start + b.duration })
  }
  const monday = fromISO(weekISO)
  for (const e of state.events) {
    if (e.start == null) continue
    const d = fromISO(e.date)
    const diff = Math.round((d.getTime() - monday.getTime()) / 86400000)
    if (diff >= 0 && diff < 7) busy.push({ day: diff, start: e.start, end: e.start + (e.duration ?? 60) })
  }
  return busy
}

function fits(busy: Busy[], day: number, start: number, duration: number): boolean {
  const end = start + duration
  return !busy.some(b => b.day === day && start < b.end && end > b.start)
}

interface Slot { day: number; start: number }

function freeSlots(state: AppState, weekISO: string, duration: number, ignoreBlockId?: string): Slot[] {
  const { dayStart, dayEnd, workDays } = state.settings
  const busy = collectBusy(state, weekISO, ignoreBlockId)
  const slots: Slot[] = []
  for (const day of workDays) {
    for (let t = dayStart; t + duration <= dayEnd; t += GRID) {
      if (fits(busy, day, t, duration)) slots.push({ day, start: t })
    }
  }
  return slots
}

/** Bias toward pleasant working hours: late morning & mid-afternoon. */
function slotScore(s: Slot, rand: () => number): number {
  const h = s.start / 60
  let score = rand() * 2
  if (h >= 9.5 && h <= 11.5) score += 2.2
  else if (h >= 13.5 && h <= 16) score += 1.8
  else if (h >= 8 && h < 9.5) score += 0.8
  return score
}

/**
 * Build the week's proposed blocks for every task that doesn't already
 * have a live (non-scrapped) block this week. Spreads load across days.
 */
export function planWeek(state: AppState, weekISO: string): Block[] {
  const rand = rng(weekISO + ':plan')
  const existing = state.blocks.filter(b => b.weekOf === weekISO)
  const covered = new Set(existing.map(b => b.taskId))

  const due = state.tasks.filter(t =>
    !t.archived &&
    !covered.has(t.id) &&
    (t.recurrence === 'weekly' || t.weekOf === weekISO),
  )
  // Longest tasks first so big blocks land while the week is empty.
  const ordered = [...due].sort((a, b) => b.duration - a.duration)

  const draft: Block[] = []
  const working: AppState = { ...state, blocks: [...state.blocks] }

  for (const task of ordered) {
    const slots = freeSlots(working, weekISO, task.duration)
    if (slots.length === 0) continue
    // Prefer the least-loaded days to spread the week out.
    const load = new Map<number, number>()
    for (const b of working.blocks) {
      if (b.weekOf === weekISO && b.status !== 'scrapped') load.set(b.day, (load.get(b.day) ?? 0) + b.duration)
    }
    const minLoad = Math.min(...working.settings.workDays.map(d => load.get(d) ?? 0))
    const preferred = slots.filter(s => (load.get(s.day) ?? 0) <= minLoad + 60)
    const pool = preferred.length > 0 ? preferred : slots
    const best = pool.reduce((a, b) => (slotScore(b, rand) > slotScore(a, rand) ? b : a))
    const block: Block = {
      id: uid(), taskId: task.id, weekOf: weekISO,
      day: best.day, start: best.start, duration: task.duration,
      status: 'proposed', strikes: 0,
    }
    draft.push(block)
    working.blocks.push(block)
  }
  return draft
}

/**
 * Propose a different time for a rejected block. Prefers a different
 * day; never re-offers the exact slot being rejected.
 */
export function proposeAlternative(state: AppState, block: Block): Slot | null {
  const rand = rng(block.weekOf + ':' + block.id + ':' + block.strikes)
  const slots = freeSlots(state, block.weekOf, block.duration, block.id)
    .filter(s => !(s.day === block.day && s.start === block.start))
  if (slots.length === 0) return null
  const otherDays = slots.filter(s => s.day !== block.day)
  const pool = otherDays.length > 0 ? otherDays : slots
  return pool.reduce((a, b) => (slotScore(b, rand) > slotScore(a, rand) ? b : a))
}

/** Events within the week (for rendering on the week grid). */
export function eventsInWeek(events: CalEvent[], weekISO: string): (CalEvent & { day: number })[] {
  const monday = fromISO(weekISO)
  const out: (CalEvent & { day: number })[] = []
  for (const e of events) {
    const diff = Math.round((fromISO(e.date).getTime() - monday.getTime()) / 86400000)
    if (diff >= 0 && diff < 7) out.push({ ...e, day: diff })
  }
  return out
}

/** Task lookup helper */
export function taskOf(state: AppState, block: Block): Task | undefined {
  return state.tasks.find(t => t.id === block.taskId)
}

export function isoForDay(weekISO: string, day: number): string {
  return toISO(addDays(fromISO(weekISO), day))
}
