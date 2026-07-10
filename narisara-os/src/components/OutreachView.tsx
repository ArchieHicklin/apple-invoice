import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import type { CostBand, OutreachChannel, OutreachIdea } from '../lib/types'
import { useToast } from './Toast'

// ── Growth: 50 outreach & revenue ideas, bilingual ─────────────────

const CHANNEL_LABEL: Record<OutreachChannel, string> = {
  social: 'Social', email: 'Email', 'in-person': 'In person', mail: 'Physical mail',
  collab: 'Collaboration', sales: 'Sales channel', press: 'Press', paid: 'Paid',
}

const COST_LABEL: Record<CostBand, string> = { free: 'Free', low: 'Low cost', medium: 'Some budget' }
const COST_DOT: Record<CostBand, string> = { free: '#548164', low: '#c29343', medium: '#c4554d' }

type Filter = 'idea' | 'doing' | 'done' | 'dismissed'

export default function OutreachView() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('idea')
  const [channel, setChannel] = useState<OutreachChannel | null>(null)
  const [cost, setCost] = useState<CostBand | null>(null)

  const ideas = useMemo(() =>
    state.outreachIdeas
      .filter(i => i.status === filter)
      .filter(i => !channel || i.channel === channel)
      .filter(i => !cost || i.cost === cost),
    [state.outreachIdeas, filter, channel, cost])

  const counts = {
    idea: state.outreachIdeas.filter(i => i.status === 'idea').length,
    doing: state.outreachIdeas.filter(i => i.status === 'doing').length,
    done: state.outreachIdeas.filter(i => i.status === 'done').length,
  }

  const setStatus = (i: OutreachIdea, status: OutreachIdea['status'], msg?: string) => {
    dispatch({ type: 'outreach/status', id: i.id, status })
    if (msg) toast(msg)
  }

  return (
    <div className="page-narrow">
      <div className="page-head">
        <div>
          <div className="page-title">Growth</div>
          <p className="page-sub">
            Fifty ways to grow your audience and your income — networking, press, collectors,
            and channels that sell. Pick two or three at a time; focus beats volume.
          </p>
        </div>
        <div className="seg">
          <button className={filter === 'idea' ? 'on' : ''} onClick={() => setFilter('idea')}>Ideas {counts.idea > 0 && `(${counts.idea})`}</button>
          <button className={filter === 'doing' ? 'on' : ''} onClick={() => setFilter('doing')}>Doing {counts.doing > 0 && `(${counts.doing})`}</button>
          <button className={filter === 'done' ? 'on' : ''} onClick={() => setFilter('done')}>Done {counts.done > 0 && `(${counts.done})`}</button>
          <button className={filter === 'dismissed' ? 'on' : ''} onClick={() => setFilter('dismissed')}>Passed</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '2px 0 8px' }}>
        {(Object.keys(CHANNEL_LABEL) as OutreachChannel[]).map(ch => (
          <button key={ch} className="pill" onClick={() => setChannel(channel === ch ? null : ch)}
            style={channel === ch ? { background: 'var(--ink)', color: '#fff' } : undefined}>
            {CHANNEL_LABEL[ch]}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0 0 18px' }}>
        {(Object.keys(COST_LABEL) as CostBand[]).map(cb => (
          <button key={cb} className="pill" onClick={() => setCost(cost === cb ? null : cb)}
            style={cost === cb ? { background: 'var(--ink)', color: '#fff' } : undefined}>
            <span className="dot" style={{ background: COST_DOT[cb] }} />
            {COST_LABEL[cb]}
          </button>
        ))}
      </div>

      {ideas.length === 0 ? (
        <div className="empty">
          <div className="glyph">✳</div>
          <h3>Nothing matches</h3>
          <p>Try clearing a filter — or celebrate, if you’ve done them all.</p>
        </div>
      ) : (
        ideas.map(i => (
          <div key={i.id} className="row-card">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3>{i.titleEn}</h3>
                <span className="pill">{CHANNEL_LABEL[i.channel]}</span>
                <span className="pill"><span className="dot" style={{ background: COST_DOT[i.cost] }} />{COST_LABEL[i.cost]}</span>
                <span className="pill">{i.effort} effort</span>
              </div>
              <div className="th-text" style={{ fontWeight: 500 }}>{i.titleTh}</div>
              <div className="why">{i.descEn}</div>
              <div className="th-text">{i.descTh}</div>
              <div className="why" style={{ marginTop: 8 }}>
                <strong style={{ color: 'var(--ok)' }}>Revenue:</strong> {i.revenueEn}
              </div>
              <div className="th-text">{i.revenueTh}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {i.status !== 'doing' && i.status !== 'done' && (
                <button className="btn btn-sm" onClick={() => setStatus(i, 'doing', 'Moved to Doing — go get it')}>Start</button>
              )}
              {i.status === 'doing' && (
                <button className="btn btn-sm" onClick={() => setStatus(i, 'done', 'Done. That’s how it grows.')}>Mark done</button>
              )}
              {i.status !== 'dismissed' ? (
                <button className="btn btn-danger-ghost btn-sm" onClick={() => setStatus(i, 'dismissed')}>Pass</button>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => setStatus(i, 'idea')}>Restore</button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
