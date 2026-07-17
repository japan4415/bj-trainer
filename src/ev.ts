/**
 * Infinite-deck blackjack EV calculation engine.
 * Uses dynamic programming with memoization.
 * Rules: S17 (dealer stands on soft 17), no blackjack bonus.
 */

import type { Action, Card, CardNumber } from './types'

// Card draw probabilities for infinite deck
const CARD_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

function cardProb(v: number): number {
  return v === 10 ? 4 / 13 : 1 / 13
}

// Dealer outcomes
type DealerOutcome = 17 | 18 | 19 | 20 | 21 | 'bust'
const DEALER_OUTCOME_TOTALS = [17, 18, 19, 20, 21] as const

// ============================================
// Hand arithmetic
// ============================================

interface HandState {
  total: number
  isSoft: boolean
}

const BUST = Symbol('bust')
type HandResult = HandState | typeof BUST

function addCardToHand(
  total: number,
  isSoft: boolean,
  cardValue: number,
): HandResult {
  if (cardValue === 1) {
    // Try Ace as 11
    if (total + 11 <= 21) {
      return { total: total + 11, isSoft: true }
    }
    // Use Ace as 1
    const newTotal = total + 1
    if (newTotal > 21) {
      if (isSoft) {
        return { total: newTotal - 10, isSoft: false }
      }
      return BUST
    }
    return { total: newTotal, isSoft }
  }

  const newTotal = total + cardValue
  if (newTotal > 21) {
    if (isSoft) {
      return { total: newTotal - 10, isSoft: false }
    }
    return BUST
  }
  return { total: newTotal, isSoft }
}

// ============================================
// Memoization caches
// ============================================

interface DealerDist {
  17: number
  18: number
  19: number
  20: number
  21: number
  bust: number
}

const dealerDistCache = new Map<string, DealerDist>()
const standEVCache = new Map<string, number>()
const hitEVCache = new Map<string, number>()

// ============================================
// Dealer final distribution
// ============================================

function emptyDist(): DealerDist {
  return { 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, bust: 0 }
}

function distKey(outcome: DealerOutcome): keyof DealerDist {
  return outcome as keyof DealerDist
}

/**
 * Compute dealer final distribution from the current hand state.
 * S17: dealer stands on all 17+ (including soft 17).
 */
function dealerDistFromState(
  total: number,
  isSoft: boolean,
): DealerDist {
  // Terminal: dealer stands on 17+
  if (total >= 17) {
    const dist = emptyDist()
    if (total > 21) {
      dist.bust = 1
    } else {
      const key = distKey(total as DealerOutcome)
      dist[key] = 1
    }
    return dist
  }

  const cacheKey = `${total}:${isSoft ? 1 : 0}`
  const cached = dealerDistCache.get(cacheKey)
  if (cached) return cached

  const dist = emptyDist()

  for (const v of CARD_VALUES) {
    const p = cardProb(v)
    const result = addCardToHand(total, isSoft, v)

    if (result === BUST) {
      dist.bust += p
    } else {
      const sub = dealerDistFromState(result.total, result.isSoft)
      for (const t of DEALER_OUTCOME_TOTALS) {
        dist[t] += p * sub[t]
      }
      dist.bust += p * sub.bust
    }
  }

  dealerDistCache.set(cacheKey, dist)
  return dist
}

/**
 * Get dealer's final probability distribution given the upcard value.
 * @param upcardValue 1=Ace, 2-10
 */
export function dealerFinalDistribution(
  upcardValue: number,
): DealerDist {
  if (upcardValue === 1) {
    return dealerDistFromState(11, true)
  }
  return dealerDistFromState(upcardValue, false)
}

// ============================================
// Stand EV
// ============================================

/**
 * EV of standing with the given player total against dealer upcard.
 * @param playerTotal player's hand total (should be <= 21)
 * @param dealerUp dealer upcard value (1=Ace, 2-10)
 */
export function standEV(playerTotal: number, dealerUp: number): number {
  const key = `${playerTotal}:${dealerUp}`
  const cached = standEVCache.get(key)
  if (cached !== undefined) return cached

  const dist = dealerFinalDistribution(dealerUp)
  let ev = 0

  // Dealer busts: player wins
  ev += dist.bust

  // Compare with each dealer total
  for (const t of DEALER_OUTCOME_TOTALS) {
    if (playerTotal > t) {
      ev += dist[t] // win
    } else if (playerTotal < t) {
      ev -= dist[t] // lose
    }
    // equal: push (0)
  }

  standEVCache.set(key, ev)
  return ev
}

// ============================================
// Hit EV
// ============================================

/**
 * EV of hitting (and playing optimally afterwards) with the given hand.
 * After hitting, the player can choose to hit again or stand (no double).
 */
export function hitEV(
  total: number,
  isSoft: boolean,
  dealerUp: number,
): number {
  const key = `${total}:${isSoft ? 1 : 0}:${dealerUp}`
  const cached = hitEVCache.get(key)
  if (cached !== undefined) return cached

  let ev = 0

  for (const v of CARD_VALUES) {
    const p = cardProb(v)
    const result = addCardToHand(total, isSoft, v)

    if (result === BUST) {
      ev += p * -1
    } else {
      const sEV = standEV(result.total, dealerUp)
      const hEV = hitEV(result.total, result.isSoft, dealerUp)
      ev += p * Math.max(sEV, hEV)
    }
  }

  hitEVCache.set(key, ev)
  return ev
}

// ============================================
// Double EV
// ============================================

/**
 * EV of doubling: draw exactly one card, bet is doubled (result x2).
 */
export function doubleEV(
  total: number,
  isSoft: boolean,
  dealerUp: number,
): number {
  let ev = 0

  for (const v of CARD_VALUES) {
    const p = cardProb(v)
    const result = addCardToHand(total, isSoft, v)

    if (result === BUST) {
      ev += p * -2
    } else {
      ev += p * 2 * standEV(result.total, dealerUp)
    }
  }

  return ev
}

// ============================================
// Split EV
// ============================================

/**
 * EV of splitting a pair.
 * @param pairCardValue BJ value of paired card (2-10 for numbers, 11 for Ace)
 * @param dealerUp dealer upcard value (1=Ace, 2-10)
 *
 * No re-splitting, no doubling after split.
 * Ace splits: each hand draws exactly one card then stands.
 */
export function splitEV(pairCardValue: number, dealerUp: number): number {
  let oneHandEV = 0

  if (pairCardValue === 11) {
    // Ace split: start with (11, soft), draw one card, stand
    for (const v of CARD_VALUES) {
      const p = cardProb(v)
      const result = addCardToHand(11, true, v)
      if (result === BUST) {
        oneHandEV += p * -1
      } else {
        oneHandEV += p * standEV(result.total, dealerUp)
      }
    }
  } else {
    // Non-Ace split: start with (pairCardValue, hard), draw one card,
    // then play optimally (hit/stand only)
    for (const v of CARD_VALUES) {
      const p = cardProb(v)
      const result = addCardToHand(pairCardValue, false, v)
      if (result === BUST) {
        oneHandEV += p * -1
      } else {
        const sEV = standEV(result.total, dealerUp)
        const hEV = hitEV(result.total, result.isSoft, dealerUp)
        oneHandEV += p * Math.max(sEV, hEV)
      }
    }
  }

  return 2 * oneHandEV
}

// ============================================
// Public API
// ============================================

/** Map a CardNumber to its blackjack draw value (1 for Ace, 10 for face cards). */
export function cardToBJValue(cardNumber: CardNumber): number {
  if (cardNumber === 1) return 1
  if (cardNumber >= 10) return 10
  return cardNumber
}

/** Compute hand state (total, isSoft) from two cards. */
export function computeHandState(card1: Card, card2: Card): HandState {
  const v1 = cardToBJValue(card1.number)
  const v2 = cardToBJValue(card2.number)

  // Both Aces
  if (v1 === 1 && v2 === 1) {
    return { total: 12, isSoft: true }
  }

  // One Ace
  if (v1 === 1) {
    return { total: 11 + v2, isSoft: true }
  }
  if (v2 === 1) {
    return { total: v1 + 11, isSoft: true }
  }

  // No Ace
  return { total: v1 + v2, isSoft: false }
}

/**
 * Get EV for each action given the player's two cards and the dealer's upcard.
 * SPLIT returns null if the hand is not a pair.
 */
export function getActionEVs(
  playerCards: [Card, Card],
  dealerCard: Card,
): Record<Action, number | null> {
  const hand = computeHandState(playerCards[0], playerCards[1])
  const dealerUp = cardToBJValue(dealerCard.number)

  const sEV = standEV(hand.total, dealerUp)
  const hEV = hitEV(hand.total, hand.isSoft, dealerUp)
  const dEV = doubleEV(hand.total, hand.isSoft, dealerUp)

  const isPair = playerCards[0].number === playerCards[1].number
  let spEV: number | null = null
  if (isPair) {
    const pairVal = cardToBJValue(playerCards[0].number)
    const splitPairVal = pairVal === 1 ? 11 : pairVal
    spEV = splitEV(splitPairVal, dealerUp)
  }

  return {
    HIT: hEV,
    STAND: sEV,
    DOUBLE: dEV,
    SPLIT: spEV,
  }
}
