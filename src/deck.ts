import type { Card, CardNumber, Suit } from './types'

const SUITS: readonly Suit[] = ['H', 'D', 'S', 'C']
const NUMBERS: readonly CardNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

/** Create a full 52-card deck */
function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const number of NUMBERS) {
      deck.push({ suit, number })
    }
  }
  return deck
}

/** Fisher-Yates shuffle */
function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = result[i]!
    result[i] = result[j]!
    result[j] = tmp
  }
  return result
}

/**
 * Deal a quiz hand: 3 cards drawn without replacement from a 52-card deck.
 * Returns [dealerCard, playerCard1, playerCard2]
 */
export function dealHand(): { dealerCard: Card; playerCards: [Card, Card] } {
  const deck = shuffle(createDeck())
  return {
    dealerCard: deck[0]!,
    playerCards: [deck[1]!, deck[2]!],
  }
}
