/**
 * Blackjack EV calculation engine.
 * Uses dynamic programming with memoization.
 * Rules: S17 (dealer stands on soft 17), no blackjack bonus.
 *
 * Supports parameterized card draw probabilities via createEvEngine().
 * The default (infinite-deck) engine is used by legacy exports for backward compatibility.
 */

import type { Action, Card, CardNumber } from './types'

// Card draw values used in EV computation
const CARD_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

/** Probability distribution for card draw values 1-10 */
export type CardProbs = Readonly<Record<number, number>>

/** Standard infinite-deck probabilities */
export function standardProbs(): CardProbs {
  const probs: Record<number, number> = {}
  for (const v of CARD_VALUES) {
    probs[v] = v === 10 ? 4 / 13 : 1 / 13
  }
  return probs
}

/**
 * Compute Ace-Five adjusted probabilities.
 *
 * c = (seen 5s) - (seen As) is the running count.
 * By definition, remaining Aces - remaining 5s = c.
 *
 * p(A) = 1/13 + c/(2N)
 * p(5) = 1/13 - c/(2N)
 * Other values unchanged. Clamp negatives to 0 and redistribute.
 */
export function aceFiveAdjustedProbs(count: number, remaining: number): CardProbs {
  if (remaining <= 0) return standardProbs()

  const base = 1 / 13
  const adjustment = count / (2 * remaining)

  let pA = base + adjustment
  let p5 = base - adjustment

  // Clamp negatives to 0, preserving pA + p5 = 2/13
  if (pA < 0) {
    p5 += pA
    pA = 0
  } else if (p5 < 0) {
    pA += p5
    p5 = 0
  }

  const probs: Record<number, number> = {}
  for (const v of CARD_VALUES) {
    if (v === 1) {
      probs[v] = pA
    } else if (v === 5) {
      probs[v] = p5
    } else if (v === 10) {
      probs[v] = 4 / 13
    } else {
      probs[v] = 1 / 13
    }
  }
  return probs
}

// Dealer outcomes
type DealerOutcome = 17 | 18 | 19 | 20 | 21 | 'bust'
const DEALER_OUTCOME_TOTALS = [17, 18, 19, 20, 21] as const

// ============================================
// Hand arithmetic (shared, stateless)
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
// Dealer distribution
// ============================================

interface DealerDist {
  17: number
  18: number
  19: number
  20: number
  21: number
  bust: number
}

function emptyDist(): DealerDist {
  return { 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, bust: 0 }
}

function distKey(outcome: DealerOutcome): keyof DealerDist {
  return outcome as keyof DealerDist
}

// ============================================
// EV Engine factory
// ============================================

export interface EvEngine {
  dealerFinalDistribution(upcardValue: number): DealerDist
  standEV(playerTotal: number, dealerUp: number): number
  hitEV(total: number, isSoft: boolean, dealerUp: number): number
  doubleEV(total: number, isSoft: boolean, dealerUp: number): number
  splitEV(pairCardValue: number, dealerUp: number): number
  getActionEVs(playerCards: [Card, Card], dealerCard: Card): Record<Action, number | null>
}

/** Create an EV engine with the given card draw probability distribution. */
export function createEvEngine(probs: CardProbs): EvEngine {
  function cardProb(v: number): number {
    return probs[v] ?? 0
  }

  // Per-engine memoization caches
  const dealerDistCache = new Map<string, DealerDist>()
  const standEVCache = new Map<string, number>()
  const hitEVCache = new Map<string, number>()

  function dealerDistFromState(
    total: number,
    isSoft: boolean,
  ): DealerDist {
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
    if (cached !== undefined) return cached

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

  function dealerFinalDistributionFn(upcardValue: number): DealerDist {
    if (upcardValue === 1) {
      return dealerDistFromState(11, true)
    }
    return dealerDistFromState(upcardValue, false)
  }

  function standEVFn(playerTotal: number, dealerUp: number): number {
    const key = `${playerTotal}:${dealerUp}`
    const cached = standEVCache.get(key)
    if (cached !== undefined) return cached

    const dist = dealerFinalDistributionFn(dealerUp)
    let ev = 0
    ev += dist.bust

    for (const t of DEALER_OUTCOME_TOTALS) {
      if (playerTotal > t) {
        ev += dist[t]
      } else if (playerTotal < t) {
        ev -= dist[t]
      }
    }

    standEVCache.set(key, ev)
    return ev
  }

  function hitEVFn(
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
        const sEV = standEVFn(result.total, dealerUp)
        const hEV = hitEVFn(result.total, result.isSoft, dealerUp)
        ev += p * Math.max(sEV, hEV)
      }
    }

    hitEVCache.set(key, ev)
    return ev
  }

  function doubleEVFn(
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
        ev += p * 2 * standEVFn(result.total, dealerUp)
      }
    }

    return ev
  }

  function splitEVFn(pairCardValue: number, dealerUp: number): number {
    let oneHandEV = 0

    if (pairCardValue === 11) {
      for (const v of CARD_VALUES) {
        const p = cardProb(v)
        const result = addCardToHand(11, true, v)
        if (result === BUST) {
          oneHandEV += p * -1
        } else {
          oneHandEV += p * standEVFn(result.total, dealerUp)
        }
      }
    } else {
      for (const v of CARD_VALUES) {
        const p = cardProb(v)
        const result = addCardToHand(pairCardValue, false, v)
        if (result === BUST) {
          oneHandEV += p * -1
        } else {
          const sEV = standEVFn(result.total, dealerUp)
          const hEV = hitEVFn(result.total, result.isSoft, dealerUp)
          oneHandEV += p * Math.max(sEV, hEV)
        }
      }
    }

    return 2 * oneHandEV
  }

  function getActionEVsFn(
    playerCards: [Card, Card],
    dealerCard: Card,
  ): Record<Action, number | null> {
    const hand = computeHandState(playerCards[0], playerCards[1])
    const dealerUp = cardToBJValue(dealerCard.number)

    const sEV = standEVFn(hand.total, dealerUp)
    const hEV = hitEVFn(hand.total, hand.isSoft, dealerUp)
    const dEV = doubleEVFn(hand.total, hand.isSoft, dealerUp)

    const isPair = playerCards[0].number === playerCards[1].number
    let spEV: number | null = null
    if (isPair) {
      const pairVal = cardToBJValue(playerCards[0].number)
      const splitPairVal = pairVal === 1 ? 11 : pairVal
      spEV = splitEVFn(splitPairVal, dealerUp)
    }

    return {
      HIT: hEV,
      STAND: sEV,
      DOUBLE: dEV,
      SPLIT: spEV,
    }
  }

  return {
    dealerFinalDistribution: dealerFinalDistributionFn,
    standEV: standEVFn,
    hitEV: hitEVFn,
    doubleEV: doubleEVFn,
    splitEV: splitEVFn,
    getActionEVs: getActionEVsFn,
  }
}

// ============================================
// Default (infinite-deck) engine singleton
// ============================================

const defaultEngine = createEvEngine(standardProbs())

// ============================================
// Public API: backward-compatible exports
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

  if (v1 === 1 && v2 === 1) {
    return { total: 12, isSoft: true }
  }
  if (v1 === 1) {
    return { total: 11 + v2, isSoft: true }
  }
  if (v2 === 1) {
    return { total: v1 + 11, isSoft: true }
  }
  return { total: v1 + v2, isSoft: false }
}

/** @deprecated Use createEvEngine() for parameterized distributions */
export function dealerFinalDistribution(upcardValue: number) {
  return defaultEngine.dealerFinalDistribution(upcardValue)
}

/** @deprecated Use createEvEngine() for parameterized distributions */
export function standEV(playerTotal: number, dealerUp: number): number {
  return defaultEngine.standEV(playerTotal, dealerUp)
}

/** @deprecated Use createEvEngine() for parameterized distributions */
export function hitEV(total: number, isSoft: boolean, dealerUp: number): number {
  return defaultEngine.hitEV(total, isSoft, dealerUp)
}

/** @deprecated Use createEvEngine() for parameterized distributions */
export function doubleEV(total: number, isSoft: boolean, dealerUp: number): number {
  return defaultEngine.doubleEV(total, isSoft, dealerUp)
}

/** @deprecated Use createEvEngine() for parameterized distributions */
export function splitEV(pairCardValue: number, dealerUp: number): number {
  return defaultEngine.splitEV(pairCardValue, dealerUp)
}

/** @deprecated Use getActionEVsWithCount() for count-adjusted EV */
export function getActionEVs(
  playerCards: [Card, Card],
  dealerCard: Card,
): Record<Action, number | null> {
  return defaultEngine.getActionEVs(playerCards, dealerCard)
}

// ============================================
// Count-adjusted API
// ============================================

/**
 * Get EV for each action using Ace-Five count-adjusted probabilities.
 * @param playerCards Player's two cards
 * @param dealerCard Dealer's upcard
 * @param count Current Ace-Five running count (post-deal)
 * @param remaining Cards remaining in the shoe (post-deal)
 */
export function getActionEVsWithCount(
  playerCards: [Card, Card],
  dealerCard: Card,
  count: number,
  remaining: number,
): Record<Action, number | null> {
  const probs = aceFiveAdjustedProbs(count, remaining)
  const engine = createEvEngine(probs)
  return engine.getActionEVs(playerCards, dealerCard)
}
