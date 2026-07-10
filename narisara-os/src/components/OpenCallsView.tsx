import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { daysUntil, fmtDeadline } from '../lib/dates'
import type { OpenCall } from '../lib/types'
import { useToast } from './Toast'

// ── Open Call Scouter ──────────────────────────────────────────────
// Researched opportunities with deadlines, fees and requirements.

type Filter = 'active' | 'saved' | 'dismissed'

function deadlineSort(a: OpenCall, b: OpenCall): number {
  const aFirm = /^\d{4}-\d{2}-\d{2}$/.test(a.deadline)
  const bFirm = /^\d{4}-\d{2}-\d{2}$/.test(b.deadline)
  if (aFirm && bFirm) return a.deadline.localeCompare(b.deadline)
  if (aFirm) return -1
  if (bFirm) return 1
  return a.deadline.localeCompare(b.deadline)
}

function DeadlineChip({ call }: { call: OpenCall }) {
  const firm = /^\d{4}-\d{2}-\d{2}$/.test(call.deadline)
  if (!firm) return <span className="deadline-chip est">{fmtDeadline(call.deadline, call.estimated)}</span>
  const days = daysUntil(call.deadline)
  const cls = days <= 21 ? 'soon' : days <= 60 ? 'mid' : 'far'
  return (
    <span className={`deadline-chip ${cls}`}>
      {fmtDeadline(call.deadline, call.estimated)}{days >= 0 && ` · ${days}d left`}
    </span>
  )
}

export default function OpenCallsView() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('active')
  const [tag, setTag] = useState<string | null>(null)

  const allTags = useMemo(() => {
    const t = new Set<string>()
    state.openCalls.forEach(c => c.tags.forEach(x => t.add(x)))
    return [...t].sort()
  }, [state.openCalls])

  const calls = useMemo(() =>
    state.openCalls
      .filter(c => c.status === filter)
      .filter(c => !tag || c.tags.includes(tag))
      .sort(deadlineSort),
    [state.openCalls, filter, tag])

  const counts = {
    active: state.openCalls.filter(c => c.status === 'active').length,
    saved: state.openCalls.filter(c => c.status === 'saved').length,
    dismissed: state.openCalls.filter(c => c.status === 'dismissed').length,
  }

  return (
    <div className="page-narrow">
      <div className="page-head">
        <div>
          <div className="page-title">Open Calls</div>
          <p className="page-sub">
            Scouted opportunities in printmaking — UK, East Asia and beyond, sorted by deadline.
            Estimated dates (~) are from annual cycles; verify before planning around them.
          </p>
        </div>
        <div className="seg">
          <button className={filter === 'active' ? 'on' : ''} onClick={() => setFilter('active')}>Inbox {counts.active > 0 && `(${counts.active})`}</button>
          <button className={filter === 'saved' ? 'on' : ''} onClick={() => setFilter('saved')}>Shortlist {counts.saved > 0 && `(${counts.saved})`}</button>
          <button className={filter === 'dismissed' ? 'on' : ''} onClick={() => setFilter('dismissed')}>Passed</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '2px 0 18px' }}>
        <button className="pill" onClick={() => setTag(null)}
          style={!tag ? { background: 'var(--ink)', color: '#fff' } : undefined}>All</button>
        {allTags.map(t => (
          <button key={t} className="pill" onClick={() => setTag(tag === t ? null : t)}
            style={tag === t ? { background: 'var(--ink)', color: '#fff' } : undefined}>{t}</button>
        ))}
      </div>

      {calls.length === 0 ? (
        <div className="empty">
          <div className="glyph">◎</div>
          <h3>Nothing here</h3>
          <p>{filter === 'active' ? 'Every call has been sorted — check your shortlist.' : 'Nothing in this list yet.'}</p>
        </div>
      ) : (
        calls.map(c => (
          <div key={c.id} className="row-card">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h3>{c.name}</h3>
                <DeadlineChip call={c} />
              </div>
              <div className="meta">{c.organization} · {c.location} · Fee: {c.fee}</div>
              <div className="why">{c.why}</div>
              <div className="meta" style={{ marginTop: 6 }}>To apply: {c.requirements}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {c.tags.map(t => <span key={t} className="pill">{t}</span>)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch' }}>
              <a className="btn btn-sm" href={c.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', textAlign: 'center' }}>
                Visit ↗
              </a>
              {c.status !== 'saved' && (
                <button className="btn btn-sm" onClick={() => { dispatch({ type: 'opencall/status', id: c.id, status: 'saved' }); toast('Shortlisted') }}>
                  Shortlist
                </button>
              )}
              {c.status !== 'dismissed' ? (
                <button className="btn btn-danger-ghost btn-sm" onClick={() => dispatch({ type: 'opencall/status', id: c.id, status: 'dismissed' })}>
                  Pass
                </button>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'opencall/status', id: c.id, status: 'active' })}>
                  Restore
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
