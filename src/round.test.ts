import { describe, it, expect } from 'vitest'
import {
  computeHandValue,
  dealRound,
  applyFirstAction,
  applyContinueAction,
  resolveRound,
  playDealer,
  determineResult,
  getCorrectActionForHand,
  reshuffleSafetyMargin,
} from './round'
import type { Card } from './types'

function card(suit: Card['suit'], number: Card['number']): Card {
  return { suit, number }
}

/** Create a drawCard function from a fixed sequence */
function fixedDraw(cards: Card[]): () => Card {
  let i = 0
  return () => {
    if (i >= cards.length) throw new Error('No more cards in fixed draw')
    return cards[i++]!
  }
}

// ============================================
// Hand value computation
// ============================================

describe('computeHandValue', () => {
  it('computes hard hand', () => {
    const hv = computeHandValue([card('H', 9), card('S', 7)])
    expect(hv.total).toBe(16)
    expect(hv.isSoft).toBe(false)
  })

  it('computes soft hand (Ace + card)', () => {
    const hv = computeHandValue([card('H', 1), card('S', 6)])
    expect(hv.total).toBe(17)
    expect(hv.isSoft).toBe(true)
  })

  it('computes multi-card hand', () => {
    // A-2-4 = soft 17
    const hv = computeHandValue([card('H', 1), card('S', 2), card('D', 4)])
    expect(hv.total).toBe(17)
    expect(hv.isSoft).toBe(true)
  })

  it('handles bust', () => {
    const hv = computeHandValue([card('H', 10), card('S', 7), card('D', 8)])
    expect(hv.total).toBe(25)
    expect(hv.isSoft).toBe(false)
  })

  it('A-2 then HIT 4 gives soft 17 (continuation scenario)', () => {
    const hv = computeHandValue([card('H', 1), card('S', 2), card('D', 4)])
    expect(hv.total).toBe(17)
    expect(hv.isSoft).toBe(true)
  })

  it('A-A = soft 12', () => {
    const hv = computeHandValue([card('H', 1), card('S', 1)])
    expect(hv.total).toBe(12)
    expect(hv.isSoft).toBe(true)
  })

  it('ace converts to 1 when would bust', () => {
    // A-9-5 = 11+9+5=25, convert A to 1: 1+9+5=15
    const hv = computeHandValue([card('H', 1), card('S', 9), card('D', 5)])
    expect(hv.total).toBe(15)
    expect(hv.isSoft).toBe(false)
  })
})

// ============================================
// User hand continuation
// ============================================

describe('User hand continuation (A-2 -> HIT -> 4)', () => {
  it('allows continued play after HIT on soft hand', () => {
    // User: A, 2.  AI: none.  Dealer up: 6, hole: 10
    // After HIT draws 4 -> soft 17, should continue
    const draw = fixedDraw([
      card('H', 1), card('S', 2),   // user
      card('D', 6), card('C', 10),  // dealer up, hole
      card('H', 4),                  // user HIT
    ])

    const { state } = dealRound(draw, 0)
    expect(state.phase).toBe('USER_FIRST_ACTION')

    const result = applyFirstAction(state, 'HIT', draw)
    // A-2-4 = soft 17, not bust, needs more decisions
    expect(result.state.userHands[0]!.total).toBe(17)
    expect(result.state.userHands[0]!.busted).toBe(false)
    expect(result.state.phase).toBe('USER_CONTINUE')
  })
})

// ============================================
// Bust
// ============================================

describe('Bust scenario', () => {
  it('user busts on HIT', () => {
    const draw = fixedDraw([
      card('H', 10), card('S', 6),  // user: 16
      card('D', 7), card('C', 10),  // dealer
      card('H', 13),                 // user HIT: K -> 26 bust
    ])

    const { state } = dealRound(draw, 0)
    const result = applyFirstAction(state, 'HIT', draw)
    expect(result.state.userHands[0]!.busted).toBe(true)
    expect(result.state.phase).toBe('ROUND_OVER')
  })
})

// ============================================
// DOUBLE
// ============================================

describe('DOUBLE action', () => {
  it('draws exactly one card and ends hand', () => {
    const draw = fixedDraw([
      card('H', 5), card('S', 6),   // user: 11
      card('D', 6), card('C', 10),  // dealer
      card('H', 10),                 // double draw: 21
    ])

    const { state } = dealRound(draw, 0)
    const result = applyFirstAction(state, 'DOUBLE', draw)
    expect(result.state.userHands[0]!.total).toBe(21)
    expect(result.state.userHands[0]!.doubled).toBe(true)
    expect(result.state.userHands[0]!.done).toBe(true)
    expect(result.state.phase).toBe('ROUND_OVER')
    expect(result.drawnCards).toHaveLength(1)
  })
})

// ============================================
// SPLIT
// ============================================

describe('SPLIT action', () => {
  it('creates two hands from a pair', () => {
    const draw = fixedDraw([
      card('H', 8), card('S', 8),   // user: 8-8
      card('D', 6), card('C', 10),  // dealer
      card('H', 3), card('S', 2),   // split draws: 8+3=11, 8+2=10
    ])

    const { state } = dealRound(draw, 0)
    const result = applyFirstAction(state, 'SPLIT', draw)
    expect(result.state.userHands).toHaveLength(2)
    expect(result.state.userHands[0]!.total).toBe(11)
    expect(result.state.userHands[1]!.total).toBe(10)
    expect(result.state.phase).toBe('USER_CONTINUE')
    expect(result.state.activeUserHandIndex).toBe(0)
  })

  it('Ace split: each hand gets one card, done immediately', () => {
    const draw = fixedDraw([
      card('H', 1), card('S', 1),   // user: A-A
      card('D', 6), card('C', 10),  // dealer
      card('H', 10), card('S', 9),  // split draws: A+10=21, A+9=20
    ])

    const { state } = dealRound(draw, 0)
    const result = applyFirstAction(state, 'SPLIT', draw)
    expect(result.state.userHands).toHaveLength(2)
    expect(result.state.userHands[0]!.total).toBe(21)
    expect(result.state.userHands[0]!.done).toBe(true)
    expect(result.state.userHands[1]!.total).toBe(20)
    expect(result.state.userHands[1]!.done).toBe(true)
    expect(result.state.phase).toBe('ROUND_OVER')
  })

  it('plays hand1 then hand2 in split', () => {
    const draw = fixedDraw([
      card('H', 7), card('S', 7),   // user: 7-7
      card('D', 6), card('C', 10),  // dealer
      card('H', 3), card('S', 4),   // split draws: 7+3=10, 7+4=11
      card('D', 10),                 // hand1 HIT: 20
      card('C', 9),                  // hand2 HIT: 20
    ])

    const { state } = dealRound(draw, 0)
    const r1 = applyFirstAction(state, 'SPLIT', draw)
    expect(r1.state.activeUserHandIndex).toBe(0)

    // Hand 1: HIT
    const r2 = applyContinueAction(r1.state, 'HIT', draw)
    expect(r2.state.userHands[0]!.total).toBe(20)
    // After STAND on hand 1, move to hand 2
    const r3 = applyContinueAction(r2.state, 'STAND', draw)
    expect(r3.state.activeUserHandIndex).toBe(1)

    // Hand 2: HIT
    const r4 = applyContinueAction(r3.state, 'HIT', draw)
    expect(r4.state.userHands[1]!.total).toBe(20)
    const r5 = applyContinueAction(r4.state, 'STAND', draw)
    expect(r5.state.phase).toBe('ROUND_OVER')
  })
})

// ============================================
// AI seat play
// ============================================

describe('AI seat play', () => {
  it('AI plays according to basic strategy', () => {
    // AI has 10-6=16 vs dealer 10. Strategy says HIT.
    const draw = fixedDraw([
      card('H', 10), card('S', 10), // user: 20
      card('D', 10), card('C', 6),  // AI seat: 16
      card('H', 10), card('S', 5),  // dealer up: 10, hole: 5
      card('D', 5),                  // AI hits: 16+5=21
      // dealer: 10+5=15, draws...
      card('H', 2),                  // dealer: 17
    ])

    const { state } = dealRound(draw, 1)
    const r1 = applyFirstAction(state, 'STAND', draw)
    const resolved = resolveRound(r1.state, draw)

    // AI should have hit (16 vs 10)
    expect(resolved.state.aiSeats[0]!.hands[0]!.cards.length).toBeGreaterThan(2)
  })

  it('AI uses DD->HIT fallback for 3+ cards', () => {
    // Verify AI with 3+ cards doesn't try to double
    // AI: 5-3 vs 6. Strategy says DOUBLE for 8 vs 6? No, 8 vs 6 = HIT.
    // Let's use: AI 5-6=11 vs 6 -> DOUBLE. After getting a card that makes 14,
    // should then HIT (not double again).
    const draw = fixedDraw([
      card('H', 10), card('S', 10), // user: 20
      card('D', 5), card('C', 6),   // AI seat: 11
      card('H', 6), card('S', 10),  // dealer up: 6, hole: 10
      card('D', 3),                  // AI doubles: 11+3=14. Done (doubled=true)
      // dealer: 6+10=16, draws...
      card('H', 7),                  // dealer: 23 bust
    ])

    const { state } = dealRound(draw, 1)
    const r1 = applyFirstAction(state, 'STAND', draw)
    const resolved = resolveRound(r1.state, draw)

    // AI doubled: exactly 3 cards
    expect(resolved.state.aiSeats[0]!.hands[0]!.cards.length).toBe(3)
    expect(resolved.state.aiSeats[0]!.hands[0]!.doubled).toBe(true)
  })
})

// ============================================
// Dealer S17 play
// ============================================

describe('Dealer play (S17)', () => {
  it('dealer stands on soft 17', () => {
    const result = playDealer(
      card('H', 1), // up: A
      card('S', 6), // hole: 6 -> soft 17
      fixedDraw([]), // should not draw
    )
    expect(result.dealerTotal).toBe(17)
    expect(result.drawnCards).toHaveLength(0)
  })

  it('dealer hits on 16', () => {
    const draw = fixedDraw([card('H', 5)]) // draws 5: 16+5=21
    const result = playDealer(
      card('H', 10), // up: 10
      card('S', 6),  // hole: 6 -> 16
      draw,
    )
    expect(result.dealerTotal).toBe(21)
    expect(result.drawnCards).toHaveLength(1)
  })

  it('dealer busts', () => {
    const draw = fixedDraw([card('H', 10)]) // draws 10: 16+10=26
    const result = playDealer(
      card('H', 10),
      card('S', 6),
      draw,
    )
    expect(result.dealerTotal).toBe(26)
    expect(result.dealerBusted).toBe(true)
  })
})

// ============================================
// Win/Lose/Push determination
// ============================================

describe('determineResult', () => {
  it('player bust = LOSE', () => {
    expect(determineResult(25, true, 20, false)).toBe('LOSE')
  })

  it('dealer bust, player alive = WIN', () => {
    expect(determineResult(18, false, 25, true)).toBe('WIN')
  })

  it('player higher = WIN', () => {
    expect(determineResult(20, false, 18, false)).toBe('WIN')
  })

  it('dealer higher = LOSE', () => {
    expect(determineResult(18, false, 20, false)).toBe('LOSE')
  })

  it('equal = PUSH', () => {
    expect(determineResult(20, false, 20, false)).toBe('PUSH')
  })

  it('both bust: player bust is LOSE (player bust checked first)', () => {
    expect(determineResult(25, true, 25, true)).toBe('LOSE')
  })
})

// ============================================
// Count tracking (hole card)
// ============================================

describe('Count tracking with hole card', () => {
  it('hole card is not in faceUpCards at deal time', () => {
    const draw = fixedDraw([
      card('H', 10), card('S', 10), // user
      card('D', 6), card('C', 1),   // dealer up: 6, hole: A
    ])

    const { faceUpCards, holeCard } = dealRound(draw, 0)

    // faceUpCards should have: user cards + dealer up
    expect(faceUpCards).toHaveLength(3)
    expect(faceUpCards).toContainEqual(card('D', 6))
    expect(faceUpCards).not.toContainEqual(card('C', 1))
    expect(holeCard).toEqual(card('C', 1))
  })

  it('hole card appears in drawnCards after resolution', () => {
    const draw = fixedDraw([
      card('H', 10), card('S', 10), // user: 20
      card('D', 6), card('C', 1),   // dealer up: 6, hole: A -> soft 17, stand
    ])

    const { state } = dealRound(draw, 0)
    const r1 = applyFirstAction(state, 'STAND', draw)
    const resolved = resolveRound(r1.state, draw)

    // drawnCards from resolve should include the hole card
    expect(resolved.drawnCards).toContainEqual(card('C', 1))
  })

  it('AI cards appear in faceUpCards at deal time', () => {
    const draw = fixedDraw([
      card('H', 10), card('S', 10), // user
      card('D', 5), card('C', 1),   // AI seat: 5, A
      card('H', 6), card('S', 10),  // dealer up: 6, hole: 10
    ])

    const { faceUpCards } = dealRound(draw, 1)

    // user(2) + AI(2) + dealer up(1) = 5
    expect(faceUpCards).toHaveLength(5)
    expect(faceUpCards).toContainEqual(card('D', 5))
    expect(faceUpCards).toContainEqual(card('C', 1))
  })
})

// ============================================
// getCorrectActionForHand
// ============================================

describe('getCorrectActionForHand', () => {
  it('returns strategy action for 2-card hand', () => {
    const action = getCorrectActionForHand(
      [card('H', 5), card('S', 6)], // 11
      card('D', 6),
      true, true,
    )
    expect(action).toBe('DOUBLE')
  })

  it('falls back DD->HIT for 3+ cards', () => {
    // Hard 11 via 3 cards: 3+4+4=11 vs 6
    const action = getCorrectActionForHand(
      [card('H', 3), card('S', 4), card('D', 4)],
      card('D', 6),
      false, false,
    )
    // Strategy for 11 says DOUBLE, but 3+ cards -> HIT
    expect(action).toBe('HIT')
  })

  it('returns STAND for hard 17+ with 3 cards', () => {
    const action = getCorrectActionForHand(
      [card('H', 10), card('S', 4), card('D', 3)], // 17
      card('D', 6),
      false, false,
    )
    expect(action).toBe('STAND')
  })
})

// ============================================
// reshuffleSafetyMargin
// ============================================

describe('reshuffleSafetyMargin', () => {
  it('returns (seatCount + 2) * 10', () => {
    expect(reshuffleSafetyMargin(0)).toBe(20)
    expect(reshuffleSafetyMargin(3)).toBe(50)
    expect(reshuffleSafetyMargin(5)).toBe(70)
  })
})

// ============================================
// Full round integration
// ============================================

describe('Full round integration', () => {
  it('completes a full round with 1 AI seat', () => {
    const draw = fixedDraw([
      card('H', 10), card('S', 10), // user: 20
      card('D', 10), card('C', 7),  // AI: 17
      card('H', 9), card('S', 10),  // dealer up: 9, hole: 10 -> 19
    ])

    const { state } = dealRound(draw, 1)
    expect(state.phase).toBe('USER_FIRST_ACTION')

    // User stands
    const r1 = applyFirstAction(state, 'STAND', draw)
    expect(r1.state.phase).toBe('ROUND_OVER')

    // Resolve: AI stands on 17, dealer has 19
    const resolved = resolveRound(r1.state, draw)
    expect(resolved.state.userResults[0]).toBe('WIN') // 20 > 19
  })
})
