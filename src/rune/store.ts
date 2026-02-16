import { create } from 'zustand';
import { type DirIndex } from './cubeMath';
import type { ParsedLevel } from './levels/types';
import { initialState, step, type SimState } from './solver/simulate';

export type Phase = 'playing' | 'won';

export type PendingMove = {
  fromIdx: number;
  toIdx: number;
  dir: DirIndex;
  fromFaces: Uint8Array;
  toFaces: Uint8Array;
  fromConsumed: bigint;
  toConsumed: bigint;
  token: number;
};

export interface RuneStore {
  level: ParsedLevel | null;
  sim: SimState | null;
  phase: Phase;
  moveCount: number;

  pending: PendingMove | null;
  isAnimating: boolean;

  loadLevel: (level: ParsedLevel) => void;
  tryMove: (dir: DirIndex) => void;
  commitMove: (token: number) => void;
  resetLevel: () => void;
}

function cloneFaces(faces: Uint8Array) {
  return new Uint8Array(faces);
}

export const useRuneStore = create<RuneStore>((set, get) => ({
  level: null,
  sim: null,
  phase: 'playing',
  moveCount: 0,
  pending: null,
  isAnimating: false,

  loadLevel: (level) => {
    set({
      level,
      sim: initialState(level),
      phase: 'playing',
      moveCount: 0,
      pending: null,
      isAnimating: false,
    });
  },

  tryMove: (dir) => {
    const { level, sim, phase, isAnimating } = get();
    if (!level || !sim || phase !== 'playing' || isAnimating) return;

    const next = step(level, sim, dir);
    if (!next) return;

    const token = ((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0) || 1;

    set({
      isAnimating: true,
      pending: {
        fromIdx: sim.idx,
        toIdx: next.idx,
        dir,
        fromFaces: cloneFaces(sim.faces),
        toFaces: cloneFaces(next.faces),
        fromConsumed: sim.consumed,
        toConsumed: next.consumed,
        token,
      },
    });
  },

  commitMove: (token) => {
    const { level, pending, phase } = get();
    if (!level || !pending || pending.token !== token || phase !== 'playing') return;

    const sim: SimState = {
      idx: pending.toIdx,
      faces: cloneFaces(pending.toFaces),
      consumed: pending.toConsumed,
    };

    const won = sim.idx === level.endIdx;

    set((state) => ({
      sim,
      moveCount: state.moveCount + 1,
      pending: null,
      isAnimating: false,
      phase: won ? 'won' : 'playing',
    }));
  },

  resetLevel: () => {
    const { level } = get();
    if (!level) return;

    set({
      sim: initialState(level),
      phase: 'playing',
      moveCount: 0,
      pending: null,
      isAnimating: false,
    });
  },
}));
