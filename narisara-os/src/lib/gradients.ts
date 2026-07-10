import type { TaskColor } from './types'

// ── Wrapped-flow gradients ─────────────────────────────────────────
// Soft, elegant full-screen gradients per task color. Used behind the
// weekly reveal cards — onboarding-flow energy, nothing garish.

export const GRADIENTS: Record<TaskColor, string> = {
  graphite: 'linear-gradient(160deg, #4a4843 0%, #2b2925 55%, #1b1a17 100%)',
  blue: 'linear-gradient(160deg, #3d6e8f 0%, #27506e 55%, #16344b 100%)',
  teal: 'linear-gradient(160deg, #3d7d70 0%, #295c52 55%, #173d36 100%)',
  green: 'linear-gradient(160deg, #4f7f5e 0%, #375e44 55%, #223e2c 100%)',
  amber: 'linear-gradient(160deg, #a87c33 0%, #7d5a22 55%, #513a15 100%)',
  peach: 'linear-gradient(160deg, #b06f3e 0%, #8a5229 55%, #58351b 100%)',
  rose: 'linear-gradient(160deg, #a85454 0%, #7e3c3c 55%, #522727 100%)',
  plum: 'linear-gradient(160deg, #7d58a8 0%, #5c3f80 55%, #3b2853 100%)',
  indigo: 'linear-gradient(160deg, #5a5aa8 0%, #414180 55%, #2a2a55 100%)',
}

export const SCRAP_GRADIENT = 'linear-gradient(160deg, #55534e 0%, #3a3835 55%, #232220 100%)'
export const FINALE_GRADIENT = 'linear-gradient(160deg, #37352f 0%, #24221e 45%, #141311 100%)'
