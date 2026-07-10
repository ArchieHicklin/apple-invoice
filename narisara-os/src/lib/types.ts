// ── Core domain types ──────────────────────────────────────────────

/** Palette of soft, Notion-ish task colors. Keys are used as ids. */
export const TASK_COLORS = {
  graphite: { label: 'Graphite', bg: '#f1f0ef', dot: '#787774', ink: '#37352f' },
  blue: { label: 'Blue', bg: '#e7f3f8', dot: '#5b97bd', ink: '#183347' },
  teal: { label: 'Teal', bg: '#e3f2ef', dot: '#4f9488', ink: '#1c3d37' },
  green: { label: 'Green', bg: '#edf3ec', dot: '#6c9b7d', ink: '#28392c' },
  amber: { label: 'Amber', bg: '#faf3dd', dot: '#c29343', ink: '#402c1b' },
  peach: { label: 'Peach', bg: '#faebdd', dot: '#d18b5c', ink: '#49290e' },
  rose: { label: 'Rose', bg: '#f9e8e8', dot: '#c56565', ink: '#4c2323' },
  plum: { label: 'Plum', bg: '#f1e9f5', dot: '#9a6dd7', ink: '#412454' },
  indigo: { label: 'Indigo', bg: '#eaeaf7', dot: '#6f6fc4', ink: '#26265a' },
} as const

export type TaskColor = keyof typeof TASK_COLORS

export interface Task {
  id: string
  name: string
  color: TaskColor
  /** duration in minutes */
  duration: number
  /** weekly = re-scheduled automatically every week */
  recurrence: 'weekly' | 'once'
  /** for one-off tasks: the ISO week-start they belong to */
  weekOf?: string
  createdAt: number
  archived?: boolean
}

export type BlockStatus = 'proposed' | 'accepted' | 'scrapped'

export interface Block {
  id: string
  taskId: string
  /** ISO date (YYYY-MM-DD) of the Monday of the week */
  weekOf: string
  /** 0 = Monday … 6 = Sunday */
  day: number
  /** minutes from midnight */
  start: number
  duration: number
  status: BlockStatus
  /** how many proposed times were rejected (max 3 = scrapped) */
  strikes: number
  done?: boolean
}

export interface CalEvent {
  id: string
  title: string
  /** ISO date YYYY-MM-DD */
  date: string
  /** minutes from midnight; undefined = all-day */
  start?: number
  duration?: number
  color: TaskColor
  note?: string
  source: 'manual' | 'ai'
}

export type IdeaStatus = 'inbox' | 'accepted' | 'rejected'

export interface ContentIdea {
  id: string
  en: string
  th: string
  detailEn: string
  detailTh: string
  format: 'reel' | 'carousel' | 'photo' | 'story' | 'video' | 'series'
  status: IdeaStatus
}

export interface OpenCall {
  id: string
  name: string
  organization: string
  location: string
  /** ISO date or human string for estimated */
  deadline: string
  estimated?: boolean
  fee: string
  requirements: string
  url: string
  why: string
  tags: string[]
  status: 'active' | 'saved' | 'dismissed'
}

export type OutreachChannel = 'social' | 'email' | 'in-person' | 'mail' | 'collab' | 'sales' | 'press' | 'paid'
export type CostBand = 'free' | 'low' | 'medium'

export interface OutreachIdea {
  id: string
  titleEn: string
  titleTh: string
  descEn: string
  descTh: string
  channel: OutreachChannel
  cost: CostBand
  effort: 'light' | 'medium' | 'deep'
  /** how it connects to revenue */
  revenueEn: string
  revenueTh: string
  status: 'idea' | 'doing' | 'done' | 'dismissed'
}

export interface Settings {
  onboarded: boolean
  name: string
  /** working window, minutes from midnight */
  dayStart: number
  dayEnd: number
  /** days available for scheduling, 0=Mon…6=Sun */
  workDays: number[]
}

export interface AppState {
  version: number
  settings: Settings
  tasks: Task[]
  blocks: Block[]
  events: CalEvent[]
  contentIdeas: ContentIdea[]
  openCalls: OpenCall[]
  outreachIdeas: OutreachIdea[]
  /** week-starts (ISO) whose "wrapped" reveal has been completed */
  wrappedDone: string[]
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
