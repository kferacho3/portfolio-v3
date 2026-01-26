import { proxy } from 'valtio'

export type OrbitLatchStatus = 'menu' | 'playing' | 'gameover'

export const orbitLatchState = proxy({
  status: 'menu' as OrbitLatchStatus,
  score: 0,
  best: 0,
})
