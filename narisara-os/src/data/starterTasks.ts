import type { TaskColor } from '../lib/types'

// ── Suggested starter tasks for onboarding ─────────────────────────
// Warm, structured defaults for a working printmaker's week.

export interface StarterTask {
  id: string
  name: string
  why: string
  duration: number
  color: TaskColor
  recommended: boolean
}

export const STARTER_TASKS: StarterTask[] = [
  {
    id: 'st-planning',
    name: 'Weekly planning hour',
    why: 'One quiet hour to look at the week ahead — this is the habit everything else hangs on.',
    duration: 60,
    color: 'graphite',
    recommended: true,
  },
  {
    id: 'st-print-day',
    name: 'Deep print day — one piece, start to finish',
    why: 'A protected block for the actual work: plate, proofs, edition. No errands allowed.',
    duration: 360,
    color: 'indigo',
    recommended: true,
  },
  {
    id: 'st-content',
    name: 'Content creation session',
    why: 'Batch-shoot process shots and studio moments while you work — future posts come from here.',
    duration: 120,
    color: 'peach',
    recommended: true,
  },
  {
    id: 'st-posting',
    name: 'Post + engage',
    why: 'Publish one piece of content and spend real time replying and connecting. Short and consistent beats long and rare.',
    duration: 45,
    color: 'rose',
    recommended: true,
  },
  {
    id: 'st-opencalls',
    name: 'Research open calls',
    why: 'One hour scouting and shortlisting opportunities — deadlines stop being scary when you see them early.',
    duration: 60,
    color: 'teal',
    recommended: true,
  },
  {
    id: 'st-outreach',
    name: 'Outreach hour',
    why: 'One email, one DM, one hello. Galleries and collectors are just people you haven’t written to yet.',
    duration: 60,
    color: 'amber',
    recommended: true,
  },
  {
    id: 'st-admin',
    name: 'Studio admin + shop',
    why: 'Orders, packaging, bookkeeping, inventory — contained in one block so it doesn’t leak everywhere.',
    duration: 60,
    color: 'blue',
    recommended: false,
  },
  {
    id: 'st-sketch',
    name: 'Sketchbook / photo walk',
    why: 'Unstructured looking time. Stations, strangers, small tender moments — fill the well.',
    duration: 90,
    color: 'green',
    recommended: false,
  },
  {
    id: 'st-learning',
    name: 'Technique study',
    why: 'Push one skill — aquatint, chine-collé, photolitho. Slow compounding.',
    duration: 90,
    color: 'plum',
    recommended: false,
  },
]
