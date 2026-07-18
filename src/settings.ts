import type { BetLevel } from './shoe'

const BET_STORAGE_KEY = 'bj-trainer-bet-level'
const SEATS_STORAGE_KEY = 'bj-trainer-seats'

export const MAX_AI_SEATS = 2

/** Clamp seat count to [0, MAX_AI_SEATS]. */
export function clampSeatCount(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(n, MAX_AI_SEATS)
}

export function loadBetLevel(): BetLevel {
  try {
    const stored = localStorage.getItem(BET_STORAGE_KEY)
    if (stored === 'normal' || stored === 'x2') return stored
  } catch { /* noop */ }
  return 'normal'
}

export function saveBetLevel(level: BetLevel): void {
  try { localStorage.setItem(BET_STORAGE_KEY, level) } catch { /* noop */ }
}

export function loadSeatCount(): number {
  try {
    const stored = localStorage.getItem(SEATS_STORAGE_KEY)
    if (stored !== null) {
      const n = parseInt(stored, 10)
      if (!Number.isNaN(n)) return clampSeatCount(n)
    }
  } catch { /* noop */ }
  return 0
}

export function saveSeatCount(n: number): void {
  try { localStorage.setItem(SEATS_STORAGE_KEY, String(n)) } catch { /* noop */ }
}
