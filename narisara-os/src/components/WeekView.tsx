import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { eventsInWeek, planWeek, taskOf } from '../lib/scheduler'
import { addDays, DAY_SHORT, fmtDayDate, fmtDuration, fmtTime, fmtWeekRange, fromISO, thisWeekISO, toISO, weekStart } from '../lib/dates'
import { TASK_COLORS, type Block } from '../lib/types'
import TaskModal from './TaskModal'
import { useToast } from './Toast'

// ── This Week: the main calendar ───────────────────────────────────

const PX_PER_HOUR = 52

interface Props {
  onOpenWrapped: (weekOf?: string) => void
}

export default function WeekView({ onOpenWrapped }: Props) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [offset, setOffset] = useState(0)
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<Block | null>(null)

  const week = useMemo(() => toISO(addDays(weekStart(new Date()), offset * 7)), [offset])
  const isThisWeek = week === thisWeekISO()
  const monday = fromISO(week)
  const todayISO = toISO(new Date())

  const { dayStart, dayEnd } = state.settings
  const gridHeight = ((dayEnd - dayStart) / 60) * PX_PER_HOUR
  const y = (mins: number) => ((mins - dayStart) / 60) * PX_PER_HOUR

  const blocks = state.blocks.filter(b => b.weekOf === week && b.status !== 'scrapped')
  const scrappedBlocks = state.blocks.filter(b => b.weekOf === week && b.status === 'scrapped')
  const events = eventsInWeek(state.events, week).filter(e => e.start != null)
  const allDay = eventsInWeek(state.events, week).filter(e => e.start == null)
  const proposedCount = blocks.filter(b => b.status === 'proposed').length

  const hours: number[] = []
  for (let h = Math.ceil(dayStart / 60); h <= Math.floor(dayEnd / 60); h++) hours.push(h)

  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const nowDay = (now.getDay() + 6) % 7

  const planFutureWeek = () => {
    const fresh = planWeek(state, week)
    if (fresh.length === 0) { toast('Nothing left to schedule for this week'); return }
    dispatch({ type: 'blocks/add', blocks: fresh })
    onOpenWrapped(week)
  }

  const futureUnplanned = !isThisWeek && offset > 0 && planWeek(state, week).length > 0

  return (
    <div className="page-wide">
      <div className="page-head">
        <div>
          <div className="page-title">{fmtWeekRange(week)}</div>
          <p className="page-sub">
            {isThisWeek
              ? proposedCount > 0
                ? `${proposedCount} session${proposedCount === 1 ? '' : 's'} still waiting for a yes — open the reveal to place them.`
                : 'Your week, already arranged. Just arrive.'
              : offset > 0 ? 'A look ahead.' : 'A look back.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="seg">
            <button onClick={() => setOffset(o => o - 1)} title="Previous week">‹</button>
            <button className={isThisWeek ? 'on' : ''} onClick={() => setOffset(0)}>Today</button>
            <button onClick={() => setOffset(o => o + 1)} title="Next week">›</button>
          </div>
          {proposedCount > 0 && isThisWeek && (
            <button className="btn" onClick={() => onOpenWrapped(week)}>Reveal week</button>
          )}
          {futureUnplanned && (
            <button className="btn" onClick={planFutureWeek}>Plan this week</button>
          )}
          <button className="btn btn-primary" onClick={() => setAdding(true)}>+ New rhythm</button>
        </div>
      </div>

      {allDay.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0 12px' }}>
          {allDay.map(e => (
            <span key={e.id} className="pill" title={e.note}
              style={{ background: TASK_COLORS[e.color].bg, color: TASK_COLORS[e.color].ink }}>
              <span className="dot" style={{ background: TASK_COLORS[e.color].dot }} />
              {fmtDayDate(fromISO(e.date))} · {e.title}
            </span>
          ))}
        </div>
      )}

      <div className="week-scroll" style={{ marginTop: 10 }}>
        <div className="week-grid">
          <div className="corner" />
          {DAY_SHORT.map((d, i) => {
            const date = addDays(monday, i)
            const isToday = toISO(date) === todayISO
            return (
              <div key={d} className={`day-head${isToday ? ' today' : ''}`}>
                {d}
                <span className="num">{date.getDate()}</span>
              </div>
            )
          })}

          <div className="time-col" style={{ height: gridHeight }}>
            {hours.map(h => (
              <span key={h} className="time-label" style={{ top: y(h * 60) }}>{fmtTime(h * 60)}</span>
            ))}
          </div>

          {Array.from({ length: 7 }, (_, day) => (
            <div key={day} className="day-col" style={{ height: gridHeight }}>
              {hours.map(h => <div key={h} className="hour-line" style={{ top: y(h * 60) }} />)}

              {isThisWeek && day === nowDay && nowMins > dayStart && nowMins < dayEnd && (
                <div className="now-line" style={{ top: y(nowMins) }} />
              )}

              {blocks.filter(b => b.day === day).map(b => {
                const task = taskOf(state, b)
                if (!task) return null
                const c = TASK_COLORS[task.color]
                return (
                  <motion.div key={b.id} layout className={`cal-block${b.done ? ' done' : ''}`}
                    initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                    style={{
                      top: y(b.start), height: Math.max(22, (b.duration / 60) * PX_PER_HOUR - 3),
                      background: c.bg, color: c.ink,
                      borderLeft: `3px solid ${c.dot}`,
                      opacity: b.status === 'proposed' ? 0.55 : undefined,
                      borderStyle: b.status === 'proposed' ? 'dashed' : undefined,
                    }}
                    onClick={() => setSelected(b)}>
                    <span className="name">{task.name}{b.status === 'proposed' ? ' ?' : ''}</span>
                    <span className="time">{fmtTime(b.start)} · {fmtDuration(b.duration)}</span>
                  </motion.div>
                )
              })}

              {events.filter(e => e.day === day).map(e => {
                const c = TASK_COLORS[e.color]
                return (
                  <div key={e.id} className="cal-block"
                    style={{
                      top: y(e.start!), height: Math.max(22, ((e.duration ?? 60) / 60) * PX_PER_HOUR - 3),
                      background: c.bg, color: c.ink, borderLeft: `3px solid ${c.dot}`,
                    }}
                    title={e.note}>
                    <span className="name">{e.title}</span>
                    <span className="time">{fmtTime(e.start!)}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {scrappedBlocks.length > 0 && (
        <p style={{ marginTop: 14, fontSize: 13, color: 'var(--ink-faint)' }}>
          Sitting this week out:{' '}
          {scrappedBlocks.map(b => taskOf(state, b)?.name).filter(Boolean).join(', ')} — back next Monday.
        </p>
      )}

      {adding && (
        <TaskModal weekOf={week} onClose={() => setAdding(false)} onScheduled={() => onOpenWrapped(week)} />
      )}

      {selected && (() => {
        const task = taskOf(state, selected)
        const live = state.blocks.find(b => b.id === selected.id)
        if (!task || !live) return null
        return (
          <div className="overlay" onClick={() => setSelected(null)}>
            <motion.div className="modal" onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.2 }}>
              <div className="modal-body">
                <h2>
                  <span className="dot" style={{ background: TASK_COLORS[task.color].dot, display: 'inline-block', marginRight: 8 }} />
                  {task.name}
                </h2>
                <p className="sub">
                  {fmtDayDate(addDays(monday, live.day))} at {fmtTime(live.start)} · {fmtDuration(live.duration)}
                  {task.recurrence === 'weekly' ? ' · repeats weekly' : ' · this week only'}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn" onClick={() => {
                    dispatch({ type: 'block/update', id: live.id, patch: { done: !live.done } })
                    setSelected(null)
                    toast(live.done ? 'Marked as not done' : 'Nice work — marked done')
                  }}>
                    {live.done ? 'Mark not done' : 'Mark done'}
                  </button>
                  <button className="btn" onClick={() => {
                    dispatch({ type: 'block/remove', id: live.id })
                    setSelected(null)
                    toast('Removed from this week')
                  }}>
                    Remove this week
                  </button>
                  {task.recurrence === 'weekly' && (
                    <button className="btn btn-danger-ghost" onClick={() => {
                      dispatch({ type: 'task/archive', id: task.id })
                      dispatch({ type: 'block/remove', id: live.id })
                      setSelected(null)
                      toast(`"${task.name}" won’t come back`)
                    }}>
                      Stop repeating
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )
      })()}
    </div>
  )
}
