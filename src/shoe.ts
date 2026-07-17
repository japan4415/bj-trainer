import type { Card, CardNumber, Suit } from './types'

const SUITS: readonly Suit[] = ['H', 'D', 'S', 'C']
const NUMBERS: readonly CardNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

const DECK_COUNT = 6
const TOTAL_CARDS = 52 * DECK_COUNT // 312
const MAX_CUTOFF = TOTAL_CARDS / 4 // 78

export type BetLevel = 'normal' | 'x2'

export interface DealResult {
  dealerCard: Card
  playerCards: [Card, Card]
  preDealCount: number
  currentCount: number
  shuffled: boolean
  remaining: number
}

/** Random number generator type: returns a value in [0, 1) */
export type RngFn = () => number

/** Fisher-Yates shuffle with injectable RNG */
function shuffle<T>(array: T[], rng: RngFn): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = result[i]!
    result[i] = result[j]!
    result[j] = tmp
  }
  return result
}

/** Create a 6-deck shoe (312 cards) */
function createShoeCards(): Card[] {
  const cards: Card[] = []
  for (let d = 0; d < DECK_COUNT; d++) {
    for (const suit of SUITS) {
      for (const number of NUMBERS) {
        cards.push({ suit, number })
      }
    }
  }
  return cards
}

/** Compute Ace-Five count delta for a single card */
function aceFiveCountDelta(card: Card): number {
  if (card.number === 5) return 1
  if (card.number === 1) return -1
  return 0
}

/** Generate a random cutoff in [0, MAX_CUTOFF] */
function generateCutoff(rng: RngFn): number {
  return Math.floor(rng() * (MAX_CUTOFF + 1))
}

/** Get recommended bet based on pre-deal count */
export function getRecommendedBet(preDealCount: number): BetLevel {
  return preDealCount >= 2 ? 'x2' : 'normal'
}

export interface Shoe {
  /** Deal 3 cards (dealer 1 + player 2). Auto-shuffles if needed before dealing. */
  deal(): DealResult
  /** Current Ace-Five running count */
  getCount(): number
  /** Number of cards remaining in the shoe */
  getRemaining(): number
}

/** Create a new 6-deck shoe */
export function createShoe(rng: RngFn = Math.random): Shoe {
  let cards: Card[] = shuffle(createShoeCards(), rng)
  let position = 0
  let count = 0
  let cutoff = generateCutoff(rng)

  function reshuffle(): void {
    cards = shuffle(createShoeCards(), rng)
    position = 0
    count = 0
    cutoff = generateCutoff(rng)
  }

  function deal(): DealResult {
    // Check if we need to reshuffle BEFORE dealing
    const remaining = TOTAL_CARDS - position
    let shuffled = false
    if (remaining <= cutoff) {
      reshuffle()
      shuffled = true
    }

    const preDealCount = count

    // Draw 3 cards
    const dealerCard = cards[position]!
    const playerCard1 = cards[position + 1]!
    const playerCard2 = cards[position + 2]!
    position += 3

    // Update count for all 3 visible cards
    count += aceFiveCountDelta(dealerCard)
    count += aceFiveCountDelta(playerCard1)
    count += aceFiveCountDelta(playerCard2)

    return {
      dealerCard,
      playerCards: [playerCard1, playerCard2],
      preDealCount,
      currentCount: count,
      shuffled,
      remaining: TOTAL_CARDS - position,
    }
  }

  return {
    deal,
    getCount: () => count,
    getRemaining: () => TOTAL_CARDS - position,
  }
}

export { TOTAL_CARDS, MAX_CUTOFF }
