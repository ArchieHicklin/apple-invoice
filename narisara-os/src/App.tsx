import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from './lib/store'
import { thisWeekISO } from './lib/dates'
import { planWeek } from './lib/scheduler'
import Sidebar, { type Tab } from './components/Sidebar'
import WeekView from './components/WeekView'
import MonthView from './components/MonthView'
import ContentStudio from './components/ContentStudio'
import OpenCallsView from './components/OpenCallsView'
import OutreachView from './components/OutreachView'
import Wrapped from './components/Wrapped'
import Onboarding from './components/Onboarding'
import { ToastProvider } from './components/Toast'

export default function App() {
  const { state, dispatch } = useStore()
  const [tab, setTab] = useState<Tab>('week')
  const [menuOpen, setMenuOpen] = useState(false)
  const [wrappedWeek, setWrappedWeek] = useState<string | null>(null)

  const week = thisWeekISO()
  const openWrapped = (w?: string) => setWrappedWeek(w ?? week)

  // Plan the current week automatically when tasks are due but unscheduled.
  useEffect(() => {
    if (!state.settings.onboarded) return
    const fresh = planWeek(state, week)
    if (fresh.length > 0) dispatch({ type: 'blocks/add', blocks: fresh })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settings.onboarded, state.tasks.length, week])

  // Monday-morning moment: first visit in a new week opens the reveal.
  const hasProposed = useMemo(
    () => state.blocks.some(b => b.weekOf === week && b.status === 'proposed'),
    [state.blocks, week],
  )
  useEffect(() => {
    if (state.settings.onboarded && hasProposed && !state.wrappedDone.includes(week)) {
      setWrappedWeek(week)
    }
  }, [state.settings.onboarded, hasProposed, state.wrappedDone, week])

  if (!state.settings.onboarded) {
    return <Onboarding />
  }

  const titles: Record<Tab, string> = {
    week: 'This Week',
    month: 'Month',
    content: 'Content Studio',
    opencalls: 'Open Calls',
    growth: 'Growth',
  }

  return (
    <ToastProvider>
      <div className="app">
        <Sidebar
          tab={tab}
          onSelect={t => { setTab(t); setMenuOpen(false) }}
          open={menuOpen}
          onOpenWrapped={() => openWrapped()}
        />
        {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
        <div className="main">
          <div className="mobile-topbar">
            <button className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(true)} aria-label="Menu">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            <span className="title">{titles[tab]}</span>
          </div>
          <div className="page">
            {tab === 'week' && <WeekView onOpenWrapped={openWrapped} />}
            {tab === 'month' && <MonthView />}
            {tab === 'content' && <ContentStudio />}
            {tab === 'opencalls' && <OpenCallsView />}
            {tab === 'growth' && <OutreachView />}
          </div>
        </div>
        <AnimatePresence>
          {wrappedWeek && (
            <motion.div key={wrappedWeek} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <Wrapped weekOf={wrappedWeek} onClose={() => setWrappedWeek(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastProvider>
  )
}
