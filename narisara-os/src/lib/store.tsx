import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { AppState, Block, CalEvent, ContentIdea, OpenCall, OutreachIdea, Settings, Task } from './types'
import { CONTENT_IDEAS } from '../data/contentIdeas'
import { OPEN_CALLS } from '../data/openCalls'
import { OUTREACH_IDEAS } from '../data/outreachIdeas'

// ── App store: reducer + localStorage persistence ──────────────────

const STORAGE_KEY = 'narisara-os:v1'

const defaultSettings: Settings = {
  onboarded: false,
  name: 'Narisara',
  dayStart: 9 * 60,
  dayEnd: 19 * 60,
  workDays: [0, 1, 2, 3, 4, 5], // Mon–Sat
}

export function initialState(): AppState {
  return {
    version: 1,
    settings: defaultSettings,
    tasks: [],
    blocks: [],
    events: [],
    contentIdeas: CONTENT_IDEAS,
    openCalls: OPEN_CALLS,
    outreachIdeas: OUTREACH_IDEAS,
    wrappedDone: [],
  }
}

export type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'task/add'; task: Task }
  | { type: 'task/update'; id: string; patch: Partial<Task> }
  | { type: 'task/archive'; id: string }
  | { type: 'blocks/add'; blocks: Block[] }
  | { type: 'block/update'; id: string; patch: Partial<Block> }
  | { type: 'block/remove'; id: string }
  | { type: 'event/add'; event: CalEvent }
  | { type: 'event/remove'; id: string }
  | { type: 'content/status'; id: string; status: ContentIdea['status'] }
  | { type: 'content/add'; idea: ContentIdea }
  | { type: 'opencall/status'; id: string; status: OpenCall['status'] }
  | { type: 'outreach/status'; id: string; status: OutreachIdea['status'] }
  | { type: 'wrapped/done'; weekOf: string }
  | { type: 'reset' }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.state
    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.patch } }
    case 'task/add':
      return { ...state, tasks: [...state.tasks, action.task] }
    case 'task/update':
      return { ...state, tasks: state.tasks.map(t => (t.id === action.id ? { ...t, ...action.patch } : t)) }
    case 'task/archive':
      return {
        ...state,
        tasks: state.tasks.map(t => (t.id === action.id ? { ...t, archived: true } : t)),
        blocks: state.blocks.filter(b => !(b.taskId === action.id && b.status === 'proposed')),
      }
    case 'blocks/add':
      return { ...state, blocks: [...state.blocks, ...action.blocks] }
    case 'block/update':
      return { ...state, blocks: state.blocks.map(b => (b.id === action.id ? { ...b, ...action.patch } : b)) }
    case 'block/remove':
      return { ...state, blocks: state.blocks.filter(b => b.id !== action.id) }
    case 'event/add':
      return { ...state, events: [...state.events, action.event] }
    case 'event/remove':
      return { ...state, events: state.events.filter(e => e.id !== action.id) }
    case 'content/status':
      return { ...state, contentIdeas: state.contentIdeas.map(i => (i.id === action.id ? { ...i, status: action.status } : i)) }
    case 'content/add':
      return { ...state, contentIdeas: [action.idea, ...state.contentIdeas] }
    case 'opencall/status':
      return { ...state, openCalls: state.openCalls.map(c => (c.id === action.id ? { ...c, status: action.status } : c)) }
    case 'outreach/status':
      return { ...state, outreachIdeas: state.outreachIdeas.map(i => (i.id === action.id ? { ...i, status: action.status } : i)) }
    case 'wrapped/done':
      return state.wrappedDone.includes(action.weekOf) ? state : { ...state, wrappedDone: [...state.wrappedDone, action.weekOf] }
    case 'reset':
      return initialState()
    default:
      return state
  }
}

function load(): AppState {
  const fresh = initialState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fresh
    const saved = JSON.parse(raw) as AppState
    // Merge in any newly-shipped seed ideas the saved state doesn't know about.
    const mergeSeed = <T extends { id: string }>(saved: T[], seed: T[]) => {
      const known = new Set(saved.map(i => i.id))
      return [...saved, ...seed.filter(i => !known.has(i.id))]
    }
    return {
      ...fresh,
      ...saved,
      settings: { ...fresh.settings, ...saved.settings },
      contentIdeas: mergeSeed(saved.contentIdeas ?? [], fresh.contentIdeas),
      openCalls: mergeSeed(saved.openCalls ?? [], fresh.openCalls),
      outreachIdeas: mergeSeed(saved.outreachIdeas ?? [], fresh.outreachIdeas),
    }
  } catch {
    return fresh
  }
}

const StoreCtx = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined as unknown as AppState, load)
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* storage full/blocked */ }
  }, [state])
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore outside provider')
  return ctx
}
