import { describe, it, expect } from 'vitest'
import { createShoe, getRecommendedBet, TOTAL_CARDS, MAX_CUTOFF } from './shoe'
import type { RngFn } from './shoe'

/** Create a seeded sequential RNG for predictable but varied output */
function seededRng(seed: number): RngFn {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff
    return s / 0x80000000
  }
}

/**
 * Create an RNG that forces a specific cutoff value.
 * Fisher-Yates on 312 cards uses 311 rng() calls (i from 311 down to 1),
 * then generateCutoff is the 312th call: Math.floor(rng() * 79).
 * We intercept call #312 to return targetCutoff / 79.
 * On reshuffle (another 311 shuffle calls + 1 cutoff call), the same logic applies.
 */
function rngWithForcedCutoff(baseSeed: number, targetCutoff: number): RngFn {
  const base = seededRng(baseSeed)
  let callCount = 0
  return () => {
    callCount++
    // Every 312th call (312, 624, 936, ...) is a cutoff generation call
    if (callCount % 312 === 0) {
      return targetCutoff / (MAX_CUTOFF + 1)
    }
    return base()
  }
}

describe('Shoe construction', () => {
  it('has 312 cards total', () => {
    const shoe = createShoe(seededRng(42))
    expect(shoe.getRemaining()).toBe(312)
  })

  it('contains exactly 24 of each rank (full shoe, cutoff=0)', () => {
    // Force cutoff=0 so we can deal all 104 hands (312 cards) without reshuffle
    const rng = rngWithForcedCutoff(42, 0)
    const shoe = createShoe(rng)

    const rankCounts = new Map<number, number>()
    for (let i = 0; i < 104; i++) {
      const result = shoe.deal()
      // No reshuffle should happen within 104 hands with cutoff=0
      // (reshuffle triggers when remaining <= 0, checked BEFORE dealing,
      //  and the first time remaining=0 is before hand 105)
      expect(result.shuffled).toBe(false)
      for (const card of [result.dealerCard, ...result.playerCards]) {
        rankCounts.set(card.number, (rankCounts.get(card.number) ?? 0) + 1)
      }
    }

    // Each of 13 ranks should appear exactly 24 times (6 decks x 4 suits)
    for (let rank = 1; rank <= 13; rank++) {
      expect(rankCounts.get(rank)).toBe(24)
    }
  })

  it('contains exactly 78 of each suit (full shoe, cutoff=0)', () => {
    const rng = rngWithForcedCutoff(42, 0)
    const shoe = createShoe(rng)

    const suitCounts = new Map<string, number>()
    for (let i = 0; i < 104; i++) {
      const result = shoe.deal()
      expect(result.shuffled).toBe(false)
      for (const card of [result.dealerCard, ...result.playerCards]) {
        suitCounts.set(card.suit, (suitCounts.get(card.suit) ?? 0) + 1)
      }
    }

    expect(suitCounts.get('H')).toBe(78)
    expect(suitCounts.get('D')).toBe(78)
    expect(suitCounts.get('S')).toBe(78)
    expect(suitCounts.get('C')).toBe(78)
  })
})

describe('Ace-Five count tracking', () => {
  it('starts at count 0', () => {
    const shoe = createShoe(seededRng(42))
    expect(shoe.getCount()).toBe(0)
  })

  it('increments by +1 when a 5 is dealt', () => {
    const rng = seededRng(100)
    const shoe = createShoe(rng)
    let expectedCount = 0

    for (let i = 0; i < 20; i++) {
      const result = shoe.deal()
      for (const card of [result.dealerCard, ...result.playerCards]) {
        if (card.number === 5) expectedCount += 1
        if (card.number === 1) expectedCount -= 1
      }
      expect(shoe.getCount()).toBe(expectedCount)
      expect(result.currentCount).toBe(expectedCount)
    }
  })

  it('decrements by -1 when an Ace is dealt', () => {
    const rng = seededRng(200)
    const shoe = createShoe(rng)

    const result1 = shoe.deal()
    let expectedCount = 0
    for (const card of [result1.dealerCard, ...result1.playerCards]) {
      if (card.number === 5) expectedCount += 1
      if (card.number === 1) expectedCount -= 1
    }
    expect(result1.currentCount).toBe(expectedCount)
  })

  it('does not change count for non-Ace, non-5 cards', () => {
    const rng = seededRng(300)
    const shoe = createShoe(rng)

    let expectedCount = 0
    for (let i = 0; i < 30; i++) {
      const result = shoe.deal()
      for (const card of [result.dealerCard, ...result.playerCards]) {
        if (card.number === 5) expectedCount += 1
        else if (card.number === 1) expectedCount -= 1
      }
      expect(result.currentCount).toBe(expectedCount)
    }
  })

  it('provides preDealCount before adding current hand cards', () => {
    const rng = seededRng(42)
    const shoe = createShoe(rng)

    const result1 = shoe.deal()
    expect(result1.preDealCount).toBe(0) // First hand always starts at 0

    const preDeal2 = shoe.getCount()
    const result2 = shoe.deal()
    expect(result2.preDealCount).toBe(preDeal2)
  })
})

describe('Shuffle and cutoff', () => {
  it('reshuffles when remaining <= cutoff before dealing', () => {
    const rng = seededRng(42)
    const shoe = createShoe(rng)

    let shuffleHappened = false
    for (let i = 0; i < 200; i++) {
      const result = shoe.deal()
      if (result.shuffled) {
        shuffleHappened = true
        // After shuffle, remaining should be 312 - 3 = 309
        expect(result.remaining).toBe(TOTAL_CARDS - 3)
        expect(result.preDealCount).toBe(0) // Count resets on shuffle
        break
      }
    }
    expect(shuffleHappened).toBe(true)
  })

  it('resets count to 0 after reshuffle', () => {
    const rng = seededRng(42)
    const shoe = createShoe(rng)

    for (let i = 0; i < 200; i++) {
      const result = shoe.deal()
      if (result.shuffled) {
        expect(result.preDealCount).toBe(0)
        break
      }
    }
  })

  it('restores to 312 cards after reshuffle (minus dealt cards)', () => {
    const rng = seededRng(42)
    const shoe = createShoe(rng)

    for (let i = 0; i < 200; i++) {
      const result = shoe.deal()
      if (result.shuffled) {
        // After shuffle and one deal: 312 - 3 = 309
        expect(result.remaining).toBe(309)
        break
      }
    }
  })

  it('cutoff is always in [0, 78] range (handCount within valid bounds)', () => {
    // With cutoff in [0, 78]:
    // - cutoff=78: reshuffle when remaining<=78, after ~78 hands -> hand 79 triggers reshuffle
    // - cutoff=0:  reshuffle when remaining<=0,  after 104 hands -> hand 105 triggers reshuffle
    // So handCount (the deal that triggers reshuffle) should be in [79, 105].
    for (let seed = 0; seed < 50; seed++) {
      const rng = seededRng(seed)
      const shoe = createShoe(rng)

      let handCount = 0
      for (let i = 0; i < 200; i++) {
        handCount++
        const result = shoe.deal()
        if (result.shuffled) {
          break
        }
      }

      // Minimum: cutoff=78 -> after 78 hands (234 cards), remaining=78<=78 -> hand 79 reshuffles
      expect(handCount).toBeGreaterThanOrEqual(79)
      // Maximum: cutoff=0 -> after 104 hands (312 cards), remaining=0<=0 -> hand 105 reshuffles
      expect(handCount).toBeLessThanOrEqual(105)
    }
  })
})

describe('getRemaining', () => {
  it('decreases by 3 after each deal', () => {
    const rng = rngWithForcedCutoff(42, 0)
    const shoe = createShoe(rng)

    expect(shoe.getRemaining()).toBe(312)

    shoe.deal()
    expect(shoe.getRemaining()).toBe(309)

    shoe.deal()
    expect(shoe.getRemaining()).toBe(306)

    shoe.deal()
    expect(shoe.getRemaining()).toBe(303)
  })

  it('restores to 309 after reshuffle (312 - 3 for the new deal)', () => {
    const rng = seededRng(42)
    const shoe = createShoe(rng)

    for (let i = 0; i < 200; i++) {
      const result = shoe.deal()
      if (result.shuffled) {
        expect(shoe.getRemaining()).toBe(309)
        expect(result.remaining).toBe(309)
        break
      }
    }
  })

  it('matches DealResult.remaining after each deal', () => {
    const rng = rngWithForcedCutoff(99, 0)
    const shoe = createShoe(rng)

    for (let i = 0; i < 10; i++) {
      const result = shoe.deal()
      expect(shoe.getRemaining()).toBe(result.remaining)
    }
  })
})

describe('getRecommendedBet', () => {
  it('returns x2 when count >= 2', () => {
    expect(getRecommendedBet(2)).toBe('x2')
    expect(getRecommendedBet(3)).toBe('x2')
    expect(getRecommendedBet(10)).toBe('x2')
  })

  it('returns normal when count <= 1', () => {
    expect(getRecommendedBet(1)).toBe('normal')
    expect(getRecommendedBet(0)).toBe('normal')
    expect(getRecommendedBet(-1)).toBe('normal')
    expect(getRecommendedBet(-5)).toBe('normal')
  })

  it('boundary: count +1 is normal, count +2 is x2', () => {
    expect(getRecommendedBet(1)).toBe('normal')
    expect(getRecommendedBet(2)).toBe('x2')
  })
})

describe('TOTAL_CARDS and MAX_CUTOFF constants', () => {
  it('TOTAL_CARDS is 312', () => {
    expect(TOTAL_CARDS).toBe(312)
  })

  it('MAX_CUTOFF is 78', () => {
    expect(MAX_CUTOFF).toBe(78)
  })
})
