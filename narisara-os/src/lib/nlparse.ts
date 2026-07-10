import type { CalEvent, TaskColor } from './types'
import { uid } from './types'
import { addDays, toISO } from './dates'

// ── Built-in natural-language event parser (offline fallback) ─────
// Handles things like:
//   "Gallery visit next friday 3pm"
//   "Print fair 12 aug"
//   "Studio open day tomorrow 10:30-13:00"
//   "Meet Fon on 2026-08-04 at 14:00 for 2 hours"

const MONTH_RX = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?'
const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}
const DOW: Record<string, number> = {
  monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5,
  saturday: 6, sat: 6, sunday: 0, sun: 0,
}

interface Parsed {
  title: string
  date: Date
  start?: number
  duration?: number
}

export function parseNaturalEvent(input: string, now = new Date()): Parsed | null {
  let text = ' ' + input.trim() + ' '
  let date: Date | null = null
  let start: number | undefined
  let duration: number | undefined

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const eat = (rx: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = text.match(rx)
    if (m) { fn(m); text = text.replace(rx, ' ') }
  }

  // ISO date
  eat(/\b(\d{4})-(\d{2})-(\d{2})\b/, m => { date = new Date(+m[1], +m[2] - 1, +m[3]) })
  // "12 aug" / "12th august" / "aug 12"
  if (!date) eat(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RX})(?:\\s+(\\d{4}))?\\b`, 'i'), m => {
    const mo = MONTH_INDEX[m[2].slice(0, 3).toLowerCase()]
    const y = m[3] ? +m[3] : now.getFullYear()
    const d = new Date(y, mo, +m[1])
    if (!m[3] && d < today) d.setFullYear(d.getFullYear() + 1)
    date = d
  })
  if (!date) eat(new RegExp(`\\b(${MONTH_RX})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'i'), m => {
    const mo = MONTH_INDEX[m[1].slice(0, 3).toLowerCase()]
    const y = m[3] ? +m[3] : now.getFullYear()
    const d = new Date(y, mo, +m[2])
    if (!m[3] && d < today) d.setFullYear(d.getFullYear() + 1)
    date = d
  })
  // relative words
  if (!date) eat(/\btoday\b/i, () => { date = today })
  if (!date) eat(/\btomorrow\b/i, () => { date = addDays(today, 1) })
  // "next friday" / "this friday" / bare "friday"
  if (!date) eat(/\b(next|this)?\s*(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)\b/i, m => {
    const target = DOW[m[2].toLowerCase()]
    let diff = (target - today.getDay() + 7) % 7
    if (diff === 0) diff = 7
    if (m[1]?.toLowerCase() === 'next' && diff <= 3) diff += 7 // "next fri" said early in the week
    date = addDays(today, diff)
  })
  // "in 3 days" / "in 2 weeks"
  if (!date) eat(/\bin\s+(\d+)\s+(day|days|week|weeks)\b/i, m => {
    const n = +m[1] * (m[2].toLowerCase().startsWith('week') ? 7 : 1)
    date = addDays(today, n)
  })

  // time range "10:30-13:00" / "10am-1pm"
  eat(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i, m => {
    const s = toMins(+m[1], m[2] ? +m[2] : 0, m[3], m[6])
    const e = toMins(+m[4], m[5] ? +m[5] : 0, m[6], m[6])
    if (s != null && e != null && e > s) { start = s; duration = e - s }
  })
  // single time "3pm" / "at 15:00" / "14.30"
  if (start == null) eat(/\b(?:at\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i, m => {
    start = toMins(+m[1], m[2] ? +m[2] : 0, m[3])
  })
  if (start == null) eat(/\bat\s+(\d{1,2})(?:[:.](\d{2}))?\b/, m => {
    start = toMins(+m[1], m[2] ? +m[2] : 0)
  })

  // "for 2 hours" / "for 90 min"
  eat(/\bfor\s+(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minutes)\b/i, m => {
    const n = +m[1]
    duration = m[2].toLowerCase().startsWith('h') ? Math.round(n * 60) : Math.round(n)
  })

  if (!date) return null

  const title = text.replace(/\s+/g, ' ').replace(/\b(on|at|the)\s*$/i, '').trim().replace(/^[-,–]\s*/, '').replace(/[-,–]\s*$/, '')
  return {
    title: title.length > 0 ? capitalize(title) : 'Event',
    date,
    start,
    duration: start != null ? (duration ?? 60) : duration,
  }
}

function toMins(h: number, m: number, suffix?: string, siblingSuffix?: string): number | undefined {
  if (h > 23 || m > 59) return undefined
  const suf = (suffix ?? siblingSuffix)?.toLowerCase()
  if (suf === 'pm' && h < 12) h += 12
  if (suf === 'am' && h === 12) h = 0
  // no suffix: assume working hours for small numbers
  if (!suf && h >= 1 && h <= 7) h += 12
  return h * 60 + m
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function parsedToEvent(p: Parsed, color: TaskColor = 'indigo'): CalEvent {
  return {
    id: uid(),
    title: p.title,
    date: toISO(p.date),
    start: p.start,
    duration: p.duration,
    color,
    source: 'manual',
  }
}
