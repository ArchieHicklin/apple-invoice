import { useStore } from '../lib/store'
import { thisWeekISO } from '../lib/dates'

export type Tab = 'week' | 'month' | 'content' | 'opencalls' | 'growth'

const stroke = { stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }

const GLYPHS: Record<Tab, JSX.Element> = {
  week: (
    <svg width="15" height="15" viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="13" height="11.5" rx="2" {...stroke} /><path d="M1.5 6h13M5 1.5v2M11 1.5v2" {...stroke} /></svg>
  ),
  month: (
    <svg width="15" height="15" viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="13" height="11.5" rx="2" {...stroke} /><path d="M1.5 6h13M5.8 9h.01M8 9h.01M10.2 9h.01M5.8 11.5h.01M8 11.5h.01" {...stroke} strokeWidth={1.8} /></svg>
  ),
  content: (
    <svg width="15" height="15" viewBox="0 0 16 16"><rect x="2.5" y="1.8" width="9" height="12.4" rx="1.8" {...stroke} transform="rotate(-6 8 8)" /><rect x="4.5" y="1.8" width="9" height="12.4" rx="1.8" {...stroke} transform="rotate(6 8 8)" /></svg>
  ),
  opencalls: (
    <svg width="15" height="15" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.8" {...stroke} /><path d="M10.6 10.6L14 14" {...stroke} /></svg>
  ),
  growth: (
    <svg width="15" height="15" viewBox="0 0 16 16"><path d="M2 13.5c1.5-4.5 4-8 8.5-9.5M13.5 2.5l.4 3.6-3.6-.4" {...stroke} /></svg>
  ),
}

interface Props {
  tab: Tab
  onSelect: (t: Tab) => void
  open: boolean
  onOpenWrapped: () => void
}

export default function Sidebar({ tab, onSelect, open, onOpenWrapped }: Props) {
  const { state } = useStore()
  const week = thisWeekISO()

  const inboxCount = state.contentIdeas.filter(i => i.status === 'inbox').length
  const activeCalls = state.openCalls.filter(c => c.status !== 'dismissed').length
  const liveIdeas = state.outreachIdeas.filter(i => i.status === 'idea' || i.status === 'doing').length
  const weekDone = state.wrappedDone.includes(week)
  const proposed = state.blocks.some(b => b.weekOf === week && b.status === 'proposed')

  const items: Array<{ id: Tab; label: string; count?: number }> = [
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'Month' },
    { id: 'content', label: 'Content Studio', count: inboxCount },
    { id: 'opencalls', label: 'Open Calls', count: activeCalls },
    { id: 'growth', label: 'Growth', count: liveIdeas },
  ]

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-brand">
        <div className="mark">N</div>
        <div className="name">Narisara <span>OS</span></div>
      </div>

      <div className="sidebar-section">Studio</div>
      {items.map(i => (
        <button key={i.id} className={`nav-item${tab === i.id ? ' active' : ''}`} onClick={() => onSelect(i.id)}>
          <span className="glyph">{GLYPHS[i.id]}</span>
          {i.label}
          {i.count != null && i.count > 0 && <span className="count">{i.count}</span>}
        </button>
      ))}

      {(!weekDone || proposed) && (
        <>
          <div className="sidebar-section">Waiting for you</div>
          <button className="nav-item" onClick={onOpenWrapped}>
            <span className="glyph">
              <svg width="15" height="15" viewBox="0 0 16 16"><path d="M8 1.8l1.7 4.2 4.5.3-3.4 2.9 1.1 4.4L8 11.2l-3.9 2.4 1.1-4.4-3.4-2.9 4.5-.3L8 1.8z" {...stroke} /></svg>
            </span>
            Reveal your week
          </button>
        </>
      )}

      <div className="sidebar-footer">
        A calm operating system for {state.settings.name}’s practice.
      </div>
    </aside>
  )
}
