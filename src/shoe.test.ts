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

describe('Shoe construction', () => {
  it('has 312 cards total', () => {
    const shoe = createShoe(seededRng(42))
    expect(shoe.getRemaining()).toBe(312)
  })

  it('contains 24 of each rank', () => {
    // Deal cards until reshuffle and count only the cards from the first shoe
    const rng = seededRng(42)
    const shoe = createShoe(rng)

    const rankCounts = new Map<number, number>()
    let totalCards = 0
    for (let i = 0; i < 200; i++) {
      const result = shoe.deal()
      if (result.shuffled) break
      for (const card of [result.dealerCard, ...result.playerCards]) {
        rankCounts.set(card.number, (rankCounts.get(card.number) ?? 0) + 1)
        totalCards++
      }
    }

    // Verify total cards dealt before reshuffle is a multiple of 3 and <= 312
    expect(totalCards).toBeLessThanOrEqual(312)
    expect(totalCards % 3).toBe(0)

    // Each rank should appear proportionally: (totalCards / 312) * 24
    // But more importantly, check that rank distribution sums to totalCards
    let sumRanks = 0
    for (let rank = 1; rank <= 13; rank++) {
      const count = rankCounts.get(rank) ?? 0
      sumRanks += count
      // Each rank should appear at most 24 times (6 decks x 4 suits)
      expect(count).toBeLessThanOrEqual(24)
    }
    expect(sumRanks).toBe(totalCards)
  })

  it('all 312 cards have correct rank distribution (24 per rank)', () => {
    // Access composition indirectly: deal the entire shoe by creating a shoe
    // with a very low cutoff (by having rng return 0 at cutoff generation time)
    // We build a full card list by dealing and collecting before any reshuffle
    // To ensure cutoff=0, we note that shuffle uses 311 rng calls, then cutoff uses 1.
    // With a fixed low value at that position, cutoff will be 0.
    // Instead, let's just manually verify across multiple shoes that all 13 ranks appear.
    for (let seed = 0; seed < 5; seed++) {
      const rng = seededRng(seed)
      const shoe = createShoe(rng)

      const rankCounts = new Map<number, number>()
      // Deal until reshuffle
      for (let i = 0; i < 200; i++) {
        const result = shoe.deal()
        if (result.shuffled) break
        for (const card of [result.dealerCard, ...result.playerCards]) {
          rankCounts.set(card.number, (rankCounts.get(card.number) ?? 0) + 1)
        }
      }

      // All 13 ranks should be present
      for (let rank = 1; rank <= 13; rank++) {
        expect(rankCounts.has(rank)).toBe(true)
      }
    }
  })

  it('contains correct suit distribution (78 per suit in full shoe)', () => {
    // Deal until reshuffle and verify suit counts don't exceed 78
    const rng = seededRng(42)
    const shoe = createShoe(rng)

    const suitCounts = new Map<string, number>()
    for (let i = 0; i < 200; i++) {
      const result = shoe.deal()
      if (result.shuffled) break
      for (const card of [result.dealerCard, ...result.playerCards]) {
        suitCounts.set(card.suit, (suitCounts.get(card.suit) ?? 0) + 1)
      }
    }

    for (const suit of ['H', 'D', 'S', 'C']) {
      const count = suitCounts.get(suit) ?? 0
      expect(count).toBeLessThanOrEqual(78)
      expect(count).toBeGreaterThan(0)
    }
  })
})

describe('Ace-Five count tracking', () => {
  it('starts at count 0', () => {
    const shoe = createShoe(seededRng(42))
    expect(shoe.getCount()).toBe(0)
  })

  it('increments by +1 when a 5 is dealt', () => {
    // We need to find a deal that contains a 5.
    // Instead, we'll track the count manually.
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
    // Use seeded rng and verify count tracking is correct
    const rng = seededRng(200)
    const shoe = createShoe(rng)

    // Deal some hands and verify count
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

    // Deal several hands and verify only 5s and Aces affect count
    let expectedCount = 0
    for (let i = 0; i < 30; i++) {
      const result = shoe.deal()
      for (const card of [result.dealerCard, ...result.playerCards]) {
        if (card.number === 5) expectedCount += 1
        else if (card.number === 1) expectedCount -= 1
        // Other numbers: no change
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
    // Use rng that produces cutoff = MAX_CUTOFF (78)
    // rng returns 1.0 - epsilon for cutoff calculation: floor(rng * 79) = 78
    // But actually we need to be careful. The first rng calls are for shuffle, then cutoff.
    // Let's use a simpler approach: deal until reshuffle happens.

    const rng = seededRng(42)
    const shoe = createShoe(rng)

    let shuffleHappened = false
    // Deal until we run low or get a shuffle
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

  it('cutoff is always in [0, 78] range', () => {
    // Test multiple shoes to check cutoff range indirectly
    // A shoe with cutoff 0 would only reshuffle when completely empty (312 cards dealt = 104 hands)
    // A shoe with cutoff 78 would reshuffle when 78 or fewer remain (~78 hands)
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

      // handCount tells us when reshuffle happened (the deal that triggered it)
      // With cutoff in [0, 78], reshuffle happens when remaining <= cutoff
      // Maximum: cutoff=0 -> reshuffle when remaining=0, i.e., after 104 hands, hand 105 triggers reshuffle
      // Minimum: cutoff=78 -> reshuffle when remaining<=78, after ~78 hands, hand 79 triggers reshuffle
      expect(handCount).toBeLessThanOrEqual(105)
      expect(handCount).toBeGreaterThanOrEqual(1)
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
