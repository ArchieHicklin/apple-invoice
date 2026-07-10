// ── Date helpers (Monday-based weeks) ─────────────────────────────

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Monday of the week containing d */
export function weekStart(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (out.getDay() + 6) % 7 // 0 = Monday
  out.setDate(out.getDate() - dow)
  return out
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

export function thisWeekISO(): string {
  return toISO(weekStart(new Date()))
}

export function nextWeekISO(): string {
  return toISO(addDays(weekStart(new Date()), 7))
}

/** "9:00" / "13:30" from minutes */
export function fmtTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const h12 = h % 12 === 0 ? 12 : h % 12
  const suffix = h < 12 ? 'am' : 'pm'
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`
}

export function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins} min`
  const h = mins / 60
  return h === Math.floor(h) ? `${h} hr${h > 1 ? 's' : ''}` : `${Math.floor(h)}h ${mins % 60}m`
}

/** "Mon 14 Jul" */
export function fmtDayDate(d: Date): string {
  return `${DAY_SHORT[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
}

/** "14–20 July 2026" style range for a week */
export function fmtWeekRange(weekISO: string): string {
  const start = fromISO(weekISO)
  const end = addDays(start, 6)
  const sm = MONTHS[start.getMonth()].slice(0, 3)
  const em = MONTHS[end.getMonth()].slice(0, 3)
  if (sm === em) return `${start.getDate()}–${end.getDate()} ${em} ${end.getFullYear()}`
  return `${start.getDate()} ${sm} – ${end.getDate()} ${em} ${end.getFullYear()}`
}

export function daysUntil(iso: string): number {
  const target = fromISO(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

export function fmtDeadline(deadline: string, estimated?: boolean): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return deadline
  const d = fromISO(deadline)
  const str = `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
  return estimated ? `~${str}` : str
}
