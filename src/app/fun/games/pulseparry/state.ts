import { proxy } from 'valtio'

export type PulseParryStatus = 'menu' | 'playing' | 'gameover'

export const pulseParryState = proxy({
  status: 'menu' as PulseParryStatus,
  score: 0,
  best: 0,
})
