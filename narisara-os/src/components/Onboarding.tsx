import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { STARTER_TASKS } from '../data/starterTasks'
import { fmtDuration } from '../lib/dates'
import { uid, type Task } from '../lib/types'

// ── First-run onboarding ───────────────────────────────────────────
// Three gentle steps: hello → shape your week → done. The goal is
// that by the end, the week plans itself and the reveal takes over.

const ease = [0.32, 0.72, 0, 1] as const

export default function Onboarding() {
  const { dispatch } = useStore()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('Narisara')
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(STARTER_TASKS.filter(t => t.recommended).map(t => t.id)),
  )

  const toggle = (id: string) => {
    setPicked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const finish = () => {
    const tasks: Task[] = STARTER_TASKS.filter(t => picked.has(t.id)).map(t => ({
      id: uid(),
      name: t.name,
      color: t.color,
      duration: t.duration,
      recurrence: 'weekly',
      createdAt: Date.now(),
    }))
    tasks.forEach(task => dispatch({ type: 'task/add', task }))
    dispatch({ type: 'settings', patch: { onboarded: true, name: name.trim() || 'Narisara' } })
  }

  return (
    <div className="onboard">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="s0" className="onboard-inner"
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.45, ease }}>
            <div className="eyebrow">Narisara OS</div>
            <h1>Hello. This is your studio’s quiet corner.</h1>
            <p className="lede">
              Planning a week alone is hard — deciding <em>when</em> to do things is somehow harder
              than doing them. So let’s make a deal: you tell this place what matters, and every
              Monday it hands you a week that’s already arranged. You just show up.
            </p>
            <label className="label" htmlFor="ob-name">What should we call you?</label>
            <input id="ob-name" className="field" value={name} onChange={e => setName(e.target.value)}
              style={{ maxWidth: 300, marginBottom: 28 }} />
            <div>
              <button className="btn btn-primary btn-lg" onClick={() => setStep(1)}>Let’s shape your week</button>
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="s1" className="onboard-inner"
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.45, ease }}>
            <div className="eyebrow">Step 2 of 3</div>
            <h1>What does a good week hold?</h1>
            <p className="lede">
              Here’s a structure that works for a practising printmaker — planning, one deep day of
              making, content, and a little outreach. Keep what feels right, drop what doesn’t.
              These repeat every week, and you can change everything later.
            </p>
            <div style={{ marginBottom: 26 }}>
              {STARTER_TASKS.map(t => {
                const on = picked.has(t.id)
                return (
                  <button key={t.id} className={`suggest-item${on ? ' on' : ''}`} onClick={() => toggle(t.id)}>
                    <span className="check">✓</span>
                    <span>
                      <span className="t-name">{t.name}</span>
                      <span className="t-why" style={{ display: 'block' }}>{t.why}</span>
                    </span>
                    <span className="t-dur">{fmtDuration(t.duration)} · weekly</span>
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost btn-lg" onClick={() => setStep(0)}>Back</button>
              <button className="btn btn-primary btn-lg" onClick={() => setStep(2)} disabled={picked.size === 0}>
                Keep {picked.size} {picked.size === 1 ? 'rhythm' : 'rhythms'}
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" className="onboard-inner"
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.45, ease }}>
            <div className="eyebrow">Step 3 of 3</div>
            <h1>One last thing — you don’t pick the times.</h1>
            <p className="lede">
              That’s the whole trick. Each week, Narisara OS places every rhythm at a specific day
              and time and presents the week to you, one card at a time. If a time truly doesn’t
              work, say so and you’ll get another — but you only get three. It keeps the calendar
              honest, and it keeps you moving. Ready to see your first week?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost btn-lg" onClick={() => setStep(1)}>Back</button>
              <button className="btn btn-primary btn-lg" onClick={finish}>Reveal my week</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
