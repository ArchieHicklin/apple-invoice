import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { aiAvailable, parseEventWithAI } from '../lib/openai'
import { taskOf, isoForDay } from '../lib/scheduler'
import { DAY_SHORT, fmtTime, MONTHS, toISO } from '../lib/dates'
import { TASK_COLORS } from '../lib/types'
import { useToast } from './Toast'

// ── Month: the wider horizon ───────────────────────────────────────
// Recurring rhythms + real-world events, added in natural language.

export default function MonthView() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const today = new Date()
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  const addEvent = async () => {
    const text = input.trim()
    if (!text || busy) return
    setBusy(true)
    const event = await parseEventWithAI(text)
    setBusy(false)
    if (!event) {
      toast('Couldn’t find a date in that — try adding one, like “12 Aug” or “next Friday”')
      return
    }
    dispatch({ type: 'event/add', event })
    setInput('')
    const d = new Date(event.date)
    toast(`Added “${event.title}” on ${d.getDate()} ${MONTHS[new Date(event.date + 'T00:00').getMonth()].slice(0, 3)}${event.start != null ? ' at ' + fmtTime(event.start) : ''}`)
  }

  // Build a 6-row calendar of dates.
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const lead = (first.getDay() + 6) % 7 // days before the 1st (Mon-start)
    const start = new Date(first)
    start.setDate(1 - lead)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [cursor])

  // Items per date: events + accepted blocks.
  const itemsByDate = useMemo(() => {
    const map = new Map<string, Array<{ id: string; label: string; color: keyof typeof TASK_COLORS; time?: number; isEvent: boolean }>>()
    for (const e of state.events) {
      const list = map.get(e.date) ?? []
      list.push({ id: e.id, label: e.title, color: e.color, time: e.start, isEvent: true })
      map.set(e.date, list)
    }
    for (const b of state.blocks) {
      if (b.status !== 'accepted') continue
      const task = taskOf(state, b)
      if (!task) continue
      const date = isoForDay(b.weekOf, b.day)
      const list = map.get(date) ?? []
      list.push({ id: b.id, label: task.name, color: task.color, time: b.start, isEvent: false })
      map.set(date, list)
    }
    for (const list of map.values()) list.sort((a, b) => (a.time ?? -1) - (b.time ?? -1))
    return map
  }, [state.events, state.blocks, state.tasks])

  const todayISO = toISO(today)

  return (
    <div className="page-wide">
      <div className="page-head">
        <div>
          <div className="page-title">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</div>
          <p className="page-sub">Everything coming up — rhythms, deadlines, real life.</p>
        </div>
        <div className="seg">
          <button onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))}>‹</button>
          <button className={cursor.getMonth() === today.getMonth() && cursor.getFullYear() === today.getFullYear() ? 'on' : ''}
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>
            Today
          </button>
          <button onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))}>›</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '6px 0 18px', alignItems: 'center' }}>
        <input className="field" style={{ maxWidth: 560 }}
          placeholder='Add anything in plain words — “Private view at Bankside next Friday 6pm”'
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addEvent()} />
        <button className="btn btn-primary" onClick={addEvent} disabled={!input.trim() || busy}>
          {busy ? 'Adding…' : 'Add'}
        </button>
        <span className="pill" title={aiAvailable()
          ? 'Natural language is parsed by AI'
          : 'Using the built-in parser. Add VITE_OPENAI_API_KEY in .env for AI parsing.'}>
          {aiAvailable() ? 'AI parsing on' : 'Built-in parser'}
        </span>
      </div>

      <div className="month-grid">
        {DAY_SHORT.map(d => <div key={d} className="month-dow">{d}</div>)}
        {cells.map(d => {
          const iso = toISO(d)
          const dim = d.getMonth() !== cursor.getMonth()
          const items = itemsByDate.get(iso) ?? []
          const shown = items.slice(0, 3)
          return (
            <div key={iso} className={`month-cell${dim ? ' dim' : ''}${iso === todayISO ? ' today' : ''}`}>
              <div className="num">{d.getDate()}</div>
              {shown.map(it => {
                const c = TASK_COLORS[it.color]
                return (
                  <div key={it.id} className="month-event"
                    style={{ background: c.bg, color: c.ink }}
                    title={`${it.label}${it.time != null ? ' · ' + fmtTime(it.time) : ''}${it.isEvent ? ' (click to remove)' : ''}`}
                    onClick={() => {
                      if (!it.isEvent) return
                      if (confirm(`Remove “${it.label}”?`)) dispatch({ type: 'event/remove', id: it.id })
                    }}>
                    <span className="dot" style={{ background: c.dot, width: 6, height: 6 }} />
                    {it.time != null && <span style={{ opacity: 0.65 }}>{fmtTime(it.time)}</span>}
                    {it.label}
                  </div>
                )
              })}
              {items.length > 3 && (
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2, paddingLeft: 6 }}>
                  +{items.length - 3} more
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
