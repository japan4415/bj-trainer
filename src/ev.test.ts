import { describe, it, expect } from 'vitest'
import {
  dealerFinalDistribution,
  standEV,
  hitEV,
  doubleEV,
  splitEV,
  getActionEVs,
  cardToBJValue,
  computeHandState,
} from './ev'
import { getCorrectAction } from './strategy'
import type { Card } from './types'

function card(suit: Card['suit'], number: Card['number']): Card {
  return { suit, number }
}

// ============================================
// Dealer distribution tests
// ============================================

describe('dealerFinalDistribution', () => {
  it('distribution sums to 1 for each upcard', () => {
    for (let up = 1; up <= 10; up++) {
      const dist = dealerFinalDistribution(up)
      const sum = dist[17] + dist[18] + dist[19] + dist[20] + dist[21] + dist.bust
      expect(sum).toBeCloseTo(1, 9)
    }
  })

  it('all probabilities are non-negative', () => {
    for (let up = 1; up <= 10; up++) {
      const dist = dealerFinalDistribution(up)
      expect(dist[17]).toBeGreaterThanOrEqual(0)
      expect(dist[18]).toBeGreaterThanOrEqual(0)
      expect(dist[19]).toBeGreaterThanOrEqual(0)
      expect(dist[20]).toBeGreaterThanOrEqual(0)
      expect(dist[21]).toBeGreaterThanOrEqual(0)
      expect(dist.bust).toBeGreaterThanOrEqual(0)
    }
  })

  it('dealer bust rate for upcard 6 is higher than for upcard 7', () => {
    // Classic: 6 is the worst upcard for the dealer
    const dist6 = dealerFinalDistribution(6)
    const dist7 = dealerFinalDistribution(7)
    expect(dist6.bust).toBeGreaterThan(dist7.bust)
  })

  it('dealer bust rate for upcard 5 is high (around 0.42)', () => {
    const dist = dealerFinalDistribution(5)
    expect(dist.bust).toBeGreaterThan(0.38)
    expect(dist.bust).toBeLessThan(0.46)
  })
})

// ============================================
// cardToBJValue and computeHandState
// ============================================

describe('cardToBJValue', () => {
  it('returns 1 for Ace', () => {
    expect(cardToBJValue(1)).toBe(1)
  })

  it('returns face value for 2-9', () => {
    expect(cardToBJValue(5)).toBe(5)
  })

  it('returns 10 for 10, J, Q, K', () => {
    expect(cardToBJValue(10)).toBe(10)
    expect(cardToBJValue(11)).toBe(10)
    expect(cardToBJValue(12)).toBe(10)
    expect(cardToBJValue(13)).toBe(10)
  })
})

describe('computeHandState', () => {
  it('computes hard hand', () => {
    const state = computeHandState(card('H', 9), card('S', 7))
    expect(state.total).toBe(16)
    expect(state.isSoft).toBe(false)
  })

  it('computes soft hand (Ace + non-Ace)', () => {
    const state = computeHandState(card('H', 1), card('S', 6))
    expect(state.total).toBe(17)
    expect(state.isSoft).toBe(true)
  })

  it('computes A-A as soft 12', () => {
    const state = computeHandState(card('H', 1), card('S', 1))
    expect(state.total).toBe(12)
    expect(state.isSoft).toBe(true)
  })

  it('computes hand with face cards', () => {
    const state = computeHandState(card('H', 13), card('S', 12))
    expect(state.total).toBe(20)
    expect(state.isSoft).toBe(false)
  })
})

// ============================================
// standEV reference values
// ============================================

describe('standEV', () => {
  it('stand 20 vs 10 is positive (around +0.40 to +0.50)', () => {
    const ev = standEV(20, 10)
    expect(ev).toBeGreaterThan(0.40)
    expect(ev).toBeLessThan(0.50)
  })

  it('stand 16 vs 10 is strongly negative', () => {
    const ev = standEV(16, 10)
    expect(ev).toBeLessThan(-0.45)
    expect(ev).toBeGreaterThan(-0.60)
  })

  it('stand 21 is positive against all dealer upcards', () => {
    for (let up = 1; up <= 10; up++) {
      const ev = standEV(21, up)
      // With infinite deck, dealer Ace can reach 21 ~36% of the time (push),
      // so EV is lower than 0.85 against Ace. Use 0.60 as floor.
      expect(ev).toBeGreaterThan(0.60)
    }
  })

  it('stand 20 is positive against all dealer upcards', () => {
    for (let up = 1; up <= 10; up++) {
      expect(standEV(20, up)).toBeGreaterThan(0)
    }
  })

  it('higher player total has higher or equal standEV', () => {
    for (let up = 1; up <= 10; up++) {
      for (let t = 5; t <= 20; t++) {
        expect(standEV(t + 1, up)).toBeGreaterThanOrEqual(standEV(t, up))
      }
    }
  })
})

// ============================================
// hitEV reference values
// ============================================

describe('hitEV', () => {
  it('hit hard 16 vs 10 is around -0.54', () => {
    const ev = hitEV(16, false, 10)
    expect(ev).toBeGreaterThan(-0.60)
    expect(ev).toBeLessThan(-0.45)
  })

  it('hit hard 4 is better than stand against every dealer', () => {
    for (let up = 1; up <= 10; up++) {
      expect(hitEV(4, false, up)).toBeGreaterThan(standEV(4, up))
    }
  })

  it('all EVs are within [-1, +1] range for hit', () => {
    for (let t = 4; t <= 20; t++) {
      for (let up = 1; up <= 10; up++) {
        const ev = hitEV(t, false, up)
        expect(ev).toBeGreaterThanOrEqual(-1)
        expect(ev).toBeLessThanOrEqual(1)
      }
    }
  })
})

// ============================================
// doubleEV reference values
// ============================================

describe('doubleEV', () => {
  it('double 11 vs 6 is greater than +0.6', () => {
    const ev = doubleEV(11, false, 6)
    expect(ev).toBeGreaterThan(0.6)
  })

  it('double 11 vs 10 is positive', () => {
    const ev = doubleEV(11, false, 10)
    expect(ev).toBeGreaterThan(0)
  })

  it('all EVs are within [-2, +2] range for double', () => {
    for (let t = 4; t <= 20; t++) {
      for (let up = 1; up <= 10; up++) {
        const ev = doubleEV(t, false, up)
        expect(ev).toBeGreaterThanOrEqual(-2)
        expect(ev).toBeLessThanOrEqual(2)
      }
    }
  })
})

// ============================================
// splitEV tests
// ============================================

describe('splitEV', () => {
  it('split 8s vs 6 is positive', () => {
    const ev = splitEV(8, 6)
    expect(ev).toBeGreaterThan(0)
  })

  it('split Aces vs 6 is positive', () => {
    const ev = splitEV(11, 6)
    expect(ev).toBeGreaterThan(0)
  })

  it('all split EVs are within [-2, +2]', () => {
    for (let pair = 2; pair <= 10; pair++) {
      for (let up = 1; up <= 10; up++) {
        const ev = splitEV(pair, up)
        expect(ev).toBeGreaterThanOrEqual(-2)
        expect(ev).toBeLessThanOrEqual(2)
      }
    }
    // Aces
    for (let up = 1; up <= 10; up++) {
      const ev = splitEV(11, up)
      expect(ev).toBeGreaterThanOrEqual(-2)
      expect(ev).toBeLessThanOrEqual(2)
    }
  })
})

// ============================================
// getActionEVs integration tests
// ============================================

describe('getActionEVs', () => {
  it('returns null SPLIT for non-pair hand', () => {
    const evs = getActionEVs(
      [card('H', 9), card('S', 7)],
      card('D', 6),
    )
    expect(evs.SPLIT).toBeNull()
    expect(evs.HIT).not.toBeNull()
    expect(evs.STAND).not.toBeNull()
    expect(evs.DOUBLE).not.toBeNull()
  })

  it('returns non-null SPLIT for pair hand', () => {
    const evs = getActionEVs(
      [card('H', 8), card('S', 8)],
      card('D', 6),
    )
    expect(evs.SPLIT).not.toBeNull()
  })

  it('argmax is STAND for hard 16 vs 6', () => {
    const evs = getActionEVs(
      [card('H', 9), card('S', 7)],
      card('D', 6),
    )
    const correct = getCorrectAction(
      [card('H', 9), card('S', 7)],
      card('D', 6),
    )
    expect(correct).toBe('STAND')

    // STAND should have the highest EV among valid (non-null) actions
    const validEVs = Object.entries(evs)
      .filter(([, v]) => v !== null) as [string, number][]
    const best = validEVs.reduce((a, b) => (b[1] > a[1] ? b : a))
    expect(best[0]).toBe('STAND')
  })

  it('argmax is DOUBLE for hard 11 vs 6', () => {
    const evs = getActionEVs(
      [card('H', 5), card('S', 6)],
      card('D', 6),
    )
    const correct = getCorrectAction(
      [card('H', 5), card('S', 6)],
      card('D', 6),
    )
    expect(correct).toBe('DOUBLE')

    const validEVs = Object.entries(evs)
      .filter(([, v]) => v !== null) as [string, number][]
    const best = validEVs.reduce((a, b) => (b[1] > a[1] ? b : a))
    expect(best[0]).toBe('DOUBLE')
  })

  it('argmax is SPLIT for 8-8 vs 6', () => {
    const evs = getActionEVs(
      [card('H', 8), card('S', 8)],
      card('D', 6),
    )
    const correct = getCorrectAction(
      [card('H', 8), card('S', 8)],
      card('D', 6),
    )
    expect(correct).toBe('SPLIT')

    const validEVs = Object.entries(evs)
      .filter(([, v]) => v !== null) as [string, number][]
    const best = validEVs.reduce((a, b) => (b[1] > a[1] ? b : a))
    expect(best[0]).toBe('SPLIT')
  })

  it('argmax is HIT for hard 8 vs 10', () => {
    const evs = getActionEVs(
      [card('H', 3), card('S', 5)],
      card('D', 10),
    )
    const correct = getCorrectAction(
      [card('H', 3), card('S', 5)],
      card('D', 10),
    )
    expect(correct).toBe('HIT')

    const validEVs = Object.entries(evs)
      .filter(([, v]) => v !== null) as [string, number][]
    const best = validEVs.reduce((a, b) => (b[1] > a[1] ? b : a))
    expect(best[0]).toBe('HIT')
  })

  it('handles A-A pair correctly', () => {
    const evs = getActionEVs(
      [card('H', 1), card('S', 1)],
      card('D', 6),
    )
    expect(evs.SPLIT).not.toBeNull()
    // SPLIT should be optimal for A-A vs 6
    const validEVs = Object.entries(evs)
      .filter(([, v]) => v !== null) as [string, number][]
    const best = validEVs.reduce((a, b) => (b[1] > a[1] ? b : a))
    expect(best[0]).toBe('SPLIT')
  })

  it('handles face card pair (J-J) correctly', () => {
    const evs = getActionEVs(
      [card('H', 11), card('S', 11)],
      card('D', 5),
    )
    // J-J = 10-10 pair, strategy says STAND
    expect(evs.SPLIT).not.toBeNull()
    const validEVs = Object.entries(evs)
      .filter(([, v]) => v !== null) as [string, number][]
    const best = validEVs.reduce((a, b) => (b[1] > a[1] ? b : a))
    expect(best[0]).toBe('STAND')
  })
})
