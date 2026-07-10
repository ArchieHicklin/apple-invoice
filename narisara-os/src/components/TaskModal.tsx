import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { planWeek } from '../lib/scheduler'
import { TASK_COLORS, uid, type Task, type TaskColor } from '../lib/types'
import { fmtDuration } from '../lib/dates'

// ── Add a rhythm (task) ────────────────────────────────────────────
// Name, colour, duration, recurrence — then the scheduler places it
// and the reveal flow proposes the time.

const DURATIONS = [30, 45, 60, 90, 120, 180, 240, 300, 360]

interface Props {
  weekOf: string
  onClose: () => void
  onScheduled: () => void
}

export default function TaskModal({ weekOf, onClose, onScheduled }: Props) {
  const { state, dispatch } = useStore()
  const [name, setName] = useState('')
  const [color, setColor] = useState<TaskColor>('blue')
  const [duration, setDuration] = useState(60)
  const [recurring, setRecurring] = useState(true)

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const task: Task = {
      id: uid(),
      name: trimmed,
      color,
      duration,
      recurrence: recurring ? 'weekly' : 'once',
      weekOf: recurring ? undefined : weekOf,
      createdAt: Date.now(),
    }
    dispatch({ type: 'task/add', task })
    // Place it in the target week immediately so the reveal can propose a time.
    const blocks = planWeek({ ...state, tasks: [...state.tasks, task] }, weekOf)
    if (blocks.length > 0) dispatch({ type: 'blocks/add', blocks })
    onClose()
    if (blocks.length > 0) onScheduled()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <motion.div className="modal" onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}>
        <div className="modal-body">
          <h2>New rhythm</h2>
          <p className="sub">Name it, size it — Narisara OS will find it a time.</p>

          <label className="label" htmlFor="task-name">What is it?</label>
          <input id="task-name" className="field" placeholder="e.g. Research open calls"
            value={name} onChange={e => setName(e.target.value)} autoFocus
            onKeyDown={e => e.key === 'Enter' && save()} style={{ marginBottom: 18 }} />

          <label className="label">Colour</label>
          <div className="swatches" style={{ marginBottom: 18 }}>
            {(Object.keys(TASK_COLORS) as TaskColor[]).map(c => (
              <button key={c} className={`swatch${color === c ? ' on' : ''}`}
                title={TASK_COLORS[c].label}
                style={{ background: TASK_COLORS[c].bg }}
                onClick={() => setColor(c)}>
                <span className="dot" style={{ background: TASK_COLORS[c].dot, position: 'absolute', inset: 0, margin: 'auto' }} />
              </button>
            ))}
          </div>

          <label className="label">How long does it take?</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
            {DURATIONS.map(d => (
              <button key={d} className="btn btn-sm" onClick={() => setDuration(d)}
                style={duration === d ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' } : undefined}>
                {fmtDuration(d)}
              </button>
            ))}
          </div>

          <label className="label">How often?</label>
          <div className="seg" style={{ marginBottom: 26 }}>
            <button className={recurring ? 'on' : ''} onClick={() => setRecurring(true)}>Every week</button>
            <button className={!recurring ? 'on' : ''} onClick={() => setRecurring(false)}>Just this week</button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>Find it a time</button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
