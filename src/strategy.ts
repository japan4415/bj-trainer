import type { Action, Card, CardNumber, HandType } from './types'

type DealerColumn = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'A'

const DEALER_COLUMNS: readonly DealerColumn[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'] as const

const H: Action = 'HIT'
const S: Action = 'STAND'
const DD: Action = 'DOUBLE'
const SP: Action = 'SPLIT'

/**
 * Hard strategy table.
 * Keys: player total (4-20)
 * Values: actions indexed by dealer column position (2,3,4,5,6,7,8,9,10,A)
 */
const HARD_TABLE: Record<number, readonly Action[]> = {
  4:  [H, H, H, H, H, H, H, H, H, H],
  5:  [H, H, H, H, H, H, H, H, H, H],
  6:  [H, H, H, H, H, H, H, H, H, H],
  7:  [H, H, H, H, H, H, H, H, H, H],
  8:  [H, H, H, H, H, H, H, H, H, H],
  9:  [H, DD, DD, DD, DD, H, H, H, H, H],
  10: [DD, DD, DD, DD, DD, DD, DD, DD, H, H],
  11: [DD, DD, DD, DD, DD, DD, DD, DD, DD, DD],
  12: [H, H, S, S, S, H, H, H, H, H],
  13: [S, S, S, S, S, H, H, H, H, H],
  14: [S, S, S, S, S, H, H, H, H, H],
  15: [S, S, S, S, S, H, H, H, H, H],
  16: [S, S, S, S, S, H, H, H, H, H],
  17: [S, S, S, S, S, S, S, S, S, S],
  18: [S, S, S, S, S, S, S, S, S, S],
  19: [S, S, S, S, S, S, S, S, S, S],
  20: [S, S, S, S, S, S, S, S, S, S],
}

/**
 * Soft strategy table.
 * Keys: the non-Ace card's value (2-10, where 10 covers 10/J/Q/K)
 * Values: actions indexed by dealer column position
 */
const SOFT_TABLE: Record<number, readonly Action[]> = {
  2:  [H, H, DD, DD, DD, H, H, H, H, H],
  3:  [H, H, DD, DD, DD, H, H, H, H, H],
  4:  [H, H, DD, DD, DD, H, H, H, H, H],
  5:  [H, H, DD, DD, DD, H, H, H, H, H],
  6:  [H, H, DD, DD, DD, H, H, H, H, H],
  7:  [S, DD, DD, DD, DD, S, S, H, H, H],
  8:  [S, S, S, S, S, S, S, S, S, S],
  9:  [S, S, S, S, S, S, S, S, S, S],
  10: [S, S, S, S, S, S, S, S, S, S],
}

/**
 * Pair strategy table.
 * Keys: the card value (2-11, where 11=Ace)
 * For 10-10 pairs (10/J/Q/K same-number pairs), key is 10.
 * Values: actions indexed by dealer column position
 */
const PAIR_TABLE: Record<number, readonly Action[]> = {
  2:  [H, H, SP, SP, SP, SP, H, H, H, H],
  3:  [H, H, SP, SP, SP, SP, H, H, H, H],
  4:  [H, H, H, H, H, H, H, H, H, H],
  5:  [DD, DD, DD, DD, DD, DD, DD, DD, H, H],
  6:  [SP, SP, SP, SP, SP, H, H, H, H, H],
  7:  [SP, SP, SP, SP, SP, SP, H, H, H, H],
  8:  [SP, SP, SP, SP, SP, SP, SP, SP, SP, SP],
  9:  [SP, SP, SP, SP, SP, S, SP, SP, S, S],
  10: [S, S, S, S, S, S, S, S, S, S],
  11: [SP, SP, SP, SP, SP, SP, SP, SP, SP, SP], // A-A
}

/** Get the blackjack value of a card number */
export function getCardValue(cardNumber: CardNumber): number {
  if (cardNumber === 1) return 11 // Ace
  if (cardNumber >= 10) return 10 // 10, J, Q, K
  return cardNumber
}

/** Get the dealer column key from a card number */
function getDealerColumn(cardNumber: CardNumber): DealerColumn {
  if (cardNumber === 1) return 'A'
  if (cardNumber >= 10) return '10'
  return String(cardNumber) as DealerColumn
}

/** Get the column index for a dealer column */
function getDealerColumnIndex(column: DealerColumn): number {
  return DEALER_COLUMNS.indexOf(column)
}

/** Classify a player hand */
export function classifyHand(card1: Card, card2: Card): { type: HandType; key: number } {
  // PAIR: same card number
  if (card1.number === card2.number) {
    const pairKey = card1.number === 1 ? 11 : getCardValue(card1.number)
    return { type: 'PAIR', key: pairKey }
  }

  // SOFT: one card is Ace
  if (card1.number === 1 || card2.number === 1) {
    const otherCard = card1.number === 1 ? card2 : card1
    const otherValue = getCardValue(otherCard.number)
    return { type: 'SOFT', key: otherValue }
  }

  // HARD: sum of values
  const total = getCardValue(card1.number) + getCardValue(card2.number)
  return { type: 'HARD', key: total }
}

/**
 * Get the correct basic strategy action for a given hand.
 * @param playerCards - The player's two cards
 * @param dealerCard - The dealer's face-up card
 * @returns The correct action according to basic strategy
 */
export function getCorrectAction(playerCards: [Card, Card], dealerCard: Card): Action {
  const [card1, card2] = playerCards
  const hand = classifyHand(card1, card2)
  const dealerCol = getDealerColumn(dealerCard.number)
  const colIndex = getDealerColumnIndex(dealerCol)

  let table: Record<number, readonly Action[]>
  switch (hand.type) {
    case 'HARD':
      table = HARD_TABLE
      break
    case 'SOFT':
      table = SOFT_TABLE
      break
    case 'PAIR':
      table = PAIR_TABLE
      break
  }

  const row = table[hand.key]
  if (!row) {
    // Fallback: should not happen with valid cards
    return 'HIT'
  }

  return row[colIndex] ?? 'HIT'
}

/**
 * Get the strategy table lookup info for highlighting purposes.
 * Returns the hand type, table row key, and dealer column index.
 */
export function getStrategyLookup(
  playerCards: [Card, Card],
  dealerCard: Card,
): { handType: HandType; rowKey: number; colIndex: number } {
  const hand = classifyHand(playerCards[0], playerCards[1])
  const dealerCol = getDealerColumn(dealerCard.number)
  const colIndex = getDealerColumnIndex(dealerCol)
  return { handType: hand.type, rowKey: hand.key, colIndex }
}

// Export tables for the explanation page
export { HARD_TABLE, SOFT_TABLE, PAIR_TABLE, DEALER_COLUMNS }
export type { DealerColumn }
