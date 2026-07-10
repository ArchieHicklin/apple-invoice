import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { proposeAlternative, taskOf } from '../lib/scheduler'
import { DAY_NAMES, fmtDuration, fmtTime, fmtWeekRange } from '../lib/dates'
import { FINALE_GRADIENT, GRADIENTS, SCRAP_GRADIENT } from '../lib/gradients'
import { TASK_COLORS } from '../lib/types'

// ── The weekly reveal ──────────────────────────────────────────────
// One gradient card per scheduled block. Lock it in, or say a time
// doesn't work — three strikes and the task sits the week out.

const ease = [0.32, 0.72, 0, 1] as const

interface Props {
  weekOf: string
  onClose: () => void
}

type Phase = 'intro' | 'cards' | 'scrap' | 'finale'

export default function Wrapped({ weekOf, onClose }: Props) {
  const { state, dispatch } = useStore()

  // Snapshot the queue when the reveal opens; read live state per step.
  const [queue] = useState<string[]>(() =>
    state.blocks
      .filter(b => b.weekOf === weekOf && b.status === 'proposed')
      .sort((a, b) => a.day - b.day || a.start - b.start)
      .map(b => b.id),
  )
  const [idx, setIdx] = useState(0)
  // Monday reveal gets the full intro; mid-week additions go straight to the card.
  const [phase, setPhase] = useState<Phase>(() =>
    queue.length === 0 ? 'finale' : state.wrappedDone.includes(weekOf) ? 'cards' : 'intro',
  )
  const [scrappedName, setScrappedName] = useState('')
  // bump forces a re-mount of the card when the same block gets a new time
  const [bump, setBump] = useState(0)

  const block = state.blocks.find(b => b.id === queue[idx])
  const task = block ? taskOf(state, block) : undefined

  const accepted = useMemo(
    () => state.blocks.filter(b => b.weekOf === weekOf && b.status === 'accepted'),
    [state.blocks, weekOf],
  )
  const scrapped = useMemo(
    () => state.blocks.filter(b => b.weekOf === weekOf && b.status === 'scrapped'),
    [state.blocks, weekOf],
  )

  const advance = () => {
    if (idx + 1 < queue.length) {
      setIdx(idx + 1)
      setPhase('cards')
    } else {
      setPhase('finale')
    }
  }

  const lockIn = () => {
    if (block) dispatch({ type: 'block/update', id: block.id, patch: { status: 'accepted' } })
    advance()
  }

  const cantMakeIt = () => {
    if (!block || !task) return
    const alt = proposeAlternative(state, block)
    if (block.strikes >= 2 || !alt) {
      // Third rejection (or nowhere left to put it): the task sits out.
      dispatch({ type: 'block/update', id: block.id, patch: { status: 'scrapped', strikes: block.strikes + 1 } })
      setScrappedName(task.name)
      setPhase('scrap')
      return
    }
    dispatch({
      type: 'block/update', id: block.id,
      patch: { day: alt.day, start: alt.start, strikes: block.strikes + 1 },
    })
    setBump(b => b + 1)
  }

  const finish = () => {
    dispatch({ type: 'wrapped/done', weekOf })
    onClose()
  }

  const gradient =
    phase === 'scrap' ? SCRAP_GRADIENT :
    phase === 'finale' || phase === 'intro' ? FINALE_GRADIENT :
    task ? GRADIENTS[task.color] : FINALE_GRADIENT

  const strikeLabel = block
    ? block.strikes === 0 ? null
    : block.strikes === 1 ? 'Second suggestion — one more after this.'
    : 'Final offer. If this doesn’t work, it sits the week out.'
    : null

  return (
    <div className="wrapped">
      {/* animated gradient backdrop */}
      <motion.div
        key={gradient}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7 }}
        style={{ position: 'absolute', inset: 0, background: gradient }}
      />
      {/* soft floating glow */}
      <motion.div
        aria-hidden
        animate={{ x: [0, 40, -30, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', width: 520, height: 520, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.13) 0%, transparent 65%)',
          top: '8%', right: '-6%', zIndex: 1,
        }}
      />

      {queue.length > 0 && phase !== 'finale' && (
        <div className="progress">
          {queue.map((id, i) => <i key={id} className={i <= idx && phase !== 'intro' ? 'on' : ''} />)}
        </div>
      )}
      <button className="skip" onClick={finish}>Skip for now</button>

      <AnimatePresence mode="wait">
        {phase === 'intro' && (
          <motion.div key="intro" className="wrapped-card"
            initial={{ opacity: 0, y: 26, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -22, scale: 0.99 }} transition={{ duration: 0.5, ease }}>
            <div className="eyebrow">{fmtWeekRange(weekOf)}</div>
            <h1>Good morning, {state.settings.name}.<br />Your week is ready.</h1>
            <p className="lede">
              {queue.length} {queue.length === 1 ? 'session has' : 'sessions have'} been placed
              across your week — each one at a real day and time. Go through them one by one.
            </p>
            <div className="wrapped-actions">
              <button className="btn-light" onClick={() => setPhase('cards')}>Show me</button>
            </div>
          </motion.div>
        )}

        {phase === 'cards' && block && task && (
          <motion.div key={block.id + ':' + bump} className="wrapped-card"
            initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.99 }} transition={{ duration: 0.45, ease }}>
            <div className="eyebrow">{idx + 1} of {queue.length} · {fmtDuration(block.duration)}</div>
            <h1><span className="big-task">{task.name}</span></h1>
            <p className="lede">{blurb(task.name, block.strikes)}</p>
            <div className="wrapped-slot">
              <span className="dot" style={{ background: TASK_COLORS[task.color].dot, width: 10, height: 10 }} />
              {DAY_NAMES[block.day]} at {fmtTime(block.start)}
            </div>
            <div className="wrapped-actions">
              <button className="btn-light" onClick={lockIn}>Lock it in</button>
              <button className="btn-glass" onClick={cantMakeIt}>
                {block.strikes >= 2 ? 'This really doesn’t work' : 'I can’t make that time'}
              </button>
            </div>
            {strikeLabel && (
              <motion.p className="strike-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {strikeLabel}
              </motion.p>
            )}
          </motion.div>
        )}

        {phase === 'scrap' && (
          <motion.div key="scrap" className="wrapped-card"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}>
            <motion.div
              initial={{ y: 0, rotate: 0, opacity: 1 }}
              animate={{ y: [0, -6, 240], rotate: [0, -3, 10], opacity: [1, 1, 0] }}
              transition={{ duration: 1.15, times: [0, 0.25, 1], ease: 'easeIn' }}
              style={{ marginBottom: 8, pointerEvents: 'none' }}
            >
              <div className="wrapped-slot" style={{ textDecoration: 'line-through', opacity: 0.85 }}>
                {scrappedName}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.45, ease }}>
              <h1 style={{ fontSize: 'clamp(24px, 4vw, 34px)' }}>Okay… it’s sitting this week out.</h1>
              <p className="lede">
                Three times didn’t fit, so <strong>{scrappedName}</strong> is off the calendar this
                week. No guilt — but it did want to happen. It’ll come back on Monday, hoping.
              </p>
              <div className="wrapped-actions">
                <button className="btn-glass" onClick={advance}>Continue</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {phase === 'finale' && (
          <motion.div key="finale" className="wrapped-card"
            initial={{ opacity: 0, y: 26, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.5, ease }}>
            <div className="eyebrow">{fmtWeekRange(weekOf)}</div>
            <h1>That’s your week, {state.settings.name}.</h1>
            <p className="lede">
              {accepted.length} {accepted.length === 1 ? 'session' : 'sessions'} locked in
              {scrapped.length > 0 && <> · {scrapped.length} sitting out</>}
              . The calendar is set — all that’s left is to arrive. Make something quiet and true this week.
            </p>
            <div className="wrapped-actions">
              <button className="btn-light" onClick={finish}>Open my calendar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** A gentle line of copy per card, varying with strikes. */
function blurb(name: string, strikes: number): string {
  if (strikes === 1) return 'Fair enough — how about this instead?'
  if (strikes >= 2) return 'Last one. A little friction is the point — protect this hour if you can.'
  const n = name.toLowerCase()
  if (n.includes('plan')) return 'The hour that makes every other hour easier. Tea, calendar, breathe.'
  if (n.includes('print') || n.includes('piece')) return 'The main event. Plate, ink, press — the whole day belongs to the work.'
  if (n.includes('content')) return 'Camera out while you work. Future-you will thank you for the footage.'
  if (n.includes('post')) return 'Ship something small and talk to the people who show up.'
  if (n.includes('open call')) return 'An hour of scouting deadlines — opportunities favour the organised.'
  if (n.includes('outreach')) return 'One email, one DM, one hello. Doors open one knock at a time.'
  if (n.includes('admin') || n.includes('shop')) return 'Keep the machine oiled — orders, numbers, inbox zero-ish.'
  if (n.includes('sketch') || n.includes('walk')) return 'Unstructured looking time. Fill the well.'
  return 'Here’s where it landed this week. Protect it if you can.'
}
