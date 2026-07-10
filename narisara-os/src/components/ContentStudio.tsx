import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import { useStore } from '../lib/store'
import type { ContentIdea } from '../lib/types'
import { uid } from '../lib/types'
import { useToast } from './Toast'

// ── Content Studio: swipe through ideas, keep the good ones ────────

const FORMAT_ART: Record<ContentIdea['format'], string> = {
  reel: 'linear-gradient(135deg, #6b8fb3 0%, #44607f 100%)',
  carousel: 'linear-gradient(135deg, #7d9b8a 0%, #55705f 100%)',
  photo: 'linear-gradient(135deg, #b39a6b 0%, #7f6a44 100%)',
  story: 'linear-gradient(135deg, #a97e6d 0%, #7a5546 100%)',
  video: 'linear-gradient(135deg, #8a7ba8 0%, #5e527a 100%)',
  series: 'linear-gradient(135deg, #b37a86 0%, #80515c 100%)',
}

export default function ContentStudio() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [view, setView] = useState<'swipe' | 'kept'>('swipe')
  const [newIdea, setNewIdea] = useState('')

  const inbox = useMemo(() => state.contentIdeas.filter(i => i.status === 'inbox'), [state.contentIdeas])
  const kept = useMemo(() => state.contentIdeas.filter(i => i.status === 'accepted'), [state.contentIdeas])
  const top = inbox[0]
  const next = inbox[1]

  const decide = (id: string, keep: boolean) => {
    dispatch({ type: 'content/status', id, status: keep ? 'accepted' : 'rejected' })
  }

  const addOwn = () => {
    const text = newIdea.trim()
    if (!text) return
    dispatch({
      type: 'content/add',
      idea: { id: uid(), en: text, th: '', detailEn: '', detailTh: '', format: 'photo', status: 'accepted' },
    })
    setNewIdea('')
    toast('Added to your kept ideas')
  }

  return (
    <div className="page-narrow">
      <div className="page-head">
        <div>
          <div className="page-title">Content Studio</div>
          <p className="page-sub">
            Swipe through ideas made for your practice. Keep what excites you — when a content
            block comes up in your week, this list is what you make from.
          </p>
        </div>
        <div className="seg">
          <button className={view === 'swipe' ? 'on' : ''} onClick={() => setView('swipe')}>
            Ideas {inbox.length > 0 && `(${inbox.length})`}
          </button>
          <button className={view === 'kept' ? 'on' : ''} onClick={() => setView('kept')}>
            Kept {kept.length > 0 && `(${kept.length})`}
          </button>
        </div>
      </div>

      {view === 'swipe' && (
        <div style={{ paddingTop: 16 }}>
          {top ? (
            <>
              <div className="deck">
                {next && (
                  <div className="swipe-card" style={{ transform: 'scale(0.955) translateY(12px)', pointerEvents: 'none', opacity: 0.7 }}>
                    <div className="art" style={{ background: FORMAT_ART[next.format] }} />
                    <div className="body"><h3>{next.en}</h3></div>
                  </div>
                )}
                <AnimatePresence>
                  <SwipeCard key={top.id} idea={top} onDecide={keep => decide(top.id, keep)} />
                </AnimatePresence>
              </div>
              <div className="deck-actions">
                <button className="deck-btn no" onClick={() => decide(top.id, false)} title="Pass">✕</button>
                <button className="deck-btn yes" onClick={() => decide(top.id, true)} title="Keep">♥</button>
              </div>
            </>
          ) : (
            <div className="empty">
              <div className="glyph">✺</div>
              <h3>You’ve seen every idea</h3>
              <p>Your kept list is ready in the next tab. New ideas will appear here when they’re added.</p>
            </div>
          )}
        </div>
      )}

      {view === 'kept' && (
        <div style={{ paddingTop: 8 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <input className="field" placeholder="Add your own idea…" value={newIdea}
              onChange={e => setNewIdea(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addOwn()} />
            <button className="btn btn-primary" onClick={addOwn} disabled={!newIdea.trim()}>Add</button>
          </div>
          {kept.length === 0 ? (
            <div className="empty">
              <div className="glyph">♡</div>
              <h3>Nothing kept yet</h3>
              <p>Swipe right on the ideas that spark something — they’ll gather here.</p>
            </div>
          ) : (
            kept.map(i => (
              <div key={i.id} className="row-card">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3>{i.en}</h3>
                    <span className="pill">{i.format}</span>
                  </div>
                  {i.th && <div className="th-text">{i.th}</div>}
                  {i.detailEn && <div className="why">{i.detailEn}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    dispatch({ type: 'content/status', id: i.id, status: 'rejected' })
                    toast('Removed')
                  }}>Remove</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function SwipeCard({ idea, onDecide }: { idea: ContentIdea; onDecide: (keep: boolean) => void }) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-260, 260], [-13, 13])
  const keepOpacity = useTransform(x, [40, 140], [0, 1])
  const passOpacity = useTransform(x, [-140, -40], [1, 0])

  return (
    <motion.div
      className="swipe-card"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={(_, info) => {
        if (info.offset.x > 110 || info.velocity.x > 600) onDecide(true)
        else if (info.offset.x < -110 || info.velocity.x < -600) onDecide(false)
      }}
      initial={{ scale: 0.97, y: 10, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{
        x: (x.get() || 1) >= 0 ? 420 : -420,
        rotate: (x.get() || 1) >= 0 ? 16 : -16,
        opacity: 0,
        transition: { duration: 0.28, ease: 'easeIn' },
      }}
      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
    >
      <div className="art" style={{ background: FORMAT_ART[idea.format] }}>
        <span className="fmt">{idea.format}</span>
      </div>
      <div className="body">
        <h3>{idea.en}</h3>
        <div className="th">{idea.th}</div>
        <div className="detail">{idea.detailEn}</div>
        <div className="detail-th">{idea.detailTh}</div>
      </div>
      <motion.span className="stamp keep" style={{ opacity: keepOpacity }}>Keep</motion.span>
      <motion.span className="stamp pass" style={{ opacity: passOpacity }}>Pass</motion.span>
    </motion.div>
  )
}
