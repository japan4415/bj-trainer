/**
 * Full-round blackjack simulation state machine.
 * React-independent. All side effects (card drawing) are injected.
 */

import type { Card, Action } from './types'
import { getCorrectAction, getCardValue } from './strategy'

// ============================================
// Hand value computation
// ============================================

export interface HandValue {
  total: number
  isSoft: boolean
}

/** Compute hand total from any number of cards */
export function computeHandValue(cards: Card[]): HandValue {
  let total = 0
  let aces = 0
  for (const card of cards) {
    if (card.number === 1) {
      aces++
      total += 11
    } else {
      total += getCardValue(card.number)
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return { total, isSoft: aces > 0 }
}

// ============================================
// Correct action for multi-card hands
// ============================================

/**
 * Get the correct action for a hand with 2 cards (uses full strategy).
 * For 3+ cards: compute from strategy tables with DD->HIT and SPLIT->HIT fallback.
 */
export function getCorrectActionForHand(
  cards: Card[],
  dealerUpCard: Card,
  canDouble: boolean,
  canSplit: boolean,
): Action {
  if (cards.length === 2 && canDouble && canSplit) {
    return getCorrectAction(cards as [Card, Card], dealerUpCard)
  }
  if (cards.length === 2) {
    const action = getCorrectAction(cards as [Card, Card], dealerUpCard)
    if (action === 'DOUBLE' && !canDouble) return 'HIT'
    if (action === 'SPLIT' && !canSplit) {
      // For non-splittable pairs (e.g., after split), look up as hard/soft
      const hv = computeHandValue(cards)
      if (hv.total >= 17) return 'STAND'
      if (hv.total <= 11) return 'HIT'
      // Use hard table logic
      return getCorrectAction(cards as [Card, Card], dealerUpCard) === 'SPLIT' ? 'STAND' : getCorrectAction(cards as [Card, Card], dealerUpCard)
    }
    return action
  }

  // 3+ cards: compute hand value and look up strategy
  const hv = computeHandValue(cards)
  if (hv.total >= 21) return 'STAND'

  // Build a synthetic 2-card hand that produces the same total/soft status
  let syntheticCards: [Card, Card]
  if (hv.isSoft) {
    // Soft hand: A + (total - 11)
    const companion = hv.total - 11
    if (companion >= 2 && companion <= 10) {
      syntheticCards = [
        { suit: 'H', number: 1 },
        { suit: 'H', number: companion as Card['number'] },
      ]
    } else {
      // Soft 21 or edge case: stand
      return 'STAND'
    }
  } else {
    // Hard hand: split into two cards that sum to total
    const half = Math.min(hv.total - 2, 10)
    const other = hv.total - half
    if (other < 2 || other > 10) return hv.total >= 17 ? 'STAND' : 'HIT'
    syntheticCards = [
      { suit: 'H', number: half as Card['number'] },
      { suit: 'H', number: other as Card['number'] },
    ]
  }

  const action = getCorrectAction(syntheticCards, dealerUpCard)
  // Fallback: DD -> HIT, SPLIT -> HIT (shouldn't occur for synthetic)
  if (action === 'DOUBLE') return 'HIT'
  if (action === 'SPLIT') return 'HIT'
  return action
}

// ============================================
// Round state types
// ============================================

export type RoundPhase =
  | 'USER_FIRST_ACTION'
  | 'USER_CONTINUE'
  | 'ROUND_OVER'

export type ContinueAction = 'HIT' | 'STAND'

export type RoundResult = 'WIN' | 'LOSE' | 'PUSH'

export interface PlayerHand {
  cards: Card[]
  total: number
  isSoft: boolean
  busted: boolean
  done: boolean
  doubled: boolean
}

export interface ContinueFeedback {
  action: ContinueAction
  correctAction: ContinueAction
  card: Card | null // null for STAND
}

export interface AiSeat {
  hands: PlayerHand[]
}

export interface RoundState {
  phase: RoundPhase
  dealerUpCard: Card
  dealerHoleCard: Card
  dealerDrawn: Card[]
  dealerTotal: number
  dealerBusted: boolean

  userHands: PlayerHand[]
  activeUserHandIndex: number

  aiSeats: AiSeat[]

  /** Correct action for the first quiz decision */
  firstActionCorrectAction: Action
  /** Feedback for continue actions (2nd action onward) */
  continueFeedback: ContinueFeedback[]
  /** Win/lose/push for each user hand (filled after resolution) */
  userResults: RoundResult[]
}

// ============================================
// Hand helpers
// ============================================

function makeHand(cards: Card[]): PlayerHand {
  const hv = computeHandValue(cards)
  return {
    cards,
    total: hv.total,
    isSoft: hv.isSoft,
    busted: hv.total > 21,
    done: hv.total > 21, // auto-done if busted
    doubled: false,
  }
}

function updateHand(hand: PlayerHand): PlayerHand {
  const hv = computeHandValue(hand.cards)
  return {
    ...hand,
    total: hv.total,
    isSoft: hv.isSoft,
    busted: hv.total > 21,
    done: hand.done || hv.total > 21,
  }
}

// ============================================
// Round creation (dealing)
// ============================================

/**
 * Deal a new round. The drawCard function must be called here to draw all
 * initial cards. Returns the initial RoundState and the list of face-up cards
 * (for count tracking by the caller).
 */
export function dealRound(
  drawCard: () => Card,
  aiSeatCount: number,
): { state: RoundState; faceUpCards: Card[]; holeCard: Card } {
  const faceUpCards: Card[] = []

  // Deal user's 2 cards
  const userCard1 = drawCard()
  const userCard2 = drawCard()
  faceUpCards.push(userCard1, userCard2)

  // Deal AI seats (each gets 2 cards, face up)
  const aiSeats: AiSeat[] = []
  for (let i = 0; i < aiSeatCount; i++) {
    const c1 = drawCard()
    const c2 = drawCard()
    faceUpCards.push(c1, c2)
    aiSeats.push({ hands: [makeHand([c1, c2])] })
  }

  // Dealer: up card (face up) + hole card (face down)
  const dealerUpCard = drawCard()
  const dealerHoleCard = drawCard()
  faceUpCards.push(dealerUpCard)
  // holeCard is NOT in faceUpCards (face down)

  const userHand = makeHand([userCard1, userCard2])
  const firstActionCorrectAction = getCorrectAction(
    [userCard1, userCard2],
    dealerUpCard,
  )

  const state: RoundState = {
    phase: 'USER_FIRST_ACTION',
    dealerUpCard,
    dealerHoleCard,
    dealerDrawn: [],
    dealerTotal: 0,
    dealerBusted: false,
    userHands: [userHand],
    activeUserHandIndex: 0,
    aiSeats,
    firstActionCorrectAction,
    continueFeedback: [],
    userResults: [],
  }

  return { state, faceUpCards, holeCard: dealerHoleCard }
}

// ============================================
// User action application
// ============================================

export interface UserActionResult {
  state: RoundState
  drawnCards: Card[] // newly visible cards (for count)
}

/**
 * Apply the user's first action (quiz action: HIT/STAND/DOUBLE/SPLIT).
 */
export function applyFirstAction(
  state: RoundState,
  action: Action,
  drawCard: () => Card,
): UserActionResult {
  if (state.phase !== 'USER_FIRST_ACTION') {
    throw new Error('Not in USER_FIRST_ACTION phase')
  }

  const drawnCards: Card[] = []
  let newState: RoundState

  switch (action) {
    case 'HIT': {
      const card = drawCard()
      drawnCards.push(card)
      const hand = state.userHands[0]!
      const newCards = [...hand.cards, card]
      const updated = updateHand({ ...makeHand(newCards), doubled: false })
      const userHands = [updated]
      newState = {
        ...state,
        userHands,
        phase: updated.done ? 'ROUND_OVER' : 'USER_CONTINUE',
      }
      break
    }
    case 'STAND': {
      const hand = state.userHands[0]!
      const userHands = [{ ...hand, done: true }]
      newState = { ...state, userHands, phase: 'ROUND_OVER' }
      break
    }
    case 'DOUBLE': {
      const card = drawCard()
      drawnCards.push(card)
      const hand = state.userHands[0]!
      const newCards = [...hand.cards, card]
      const hv = computeHandValue(newCards)
      const userHands = [{
        cards: newCards,
        total: hv.total,
        isSoft: hv.isSoft,
        busted: hv.total > 21,
        done: true,
        doubled: true,
      }]
      newState = { ...state, userHands, phase: 'ROUND_OVER' }
      break
    }
    case 'SPLIT': {
      const hand = state.userHands[0]!
      const card1 = hand.cards[0]!
      const card2 = hand.cards[1]!
      const isAceSplit = card1.number === 1

      // Draw one card for each split hand
      const draw1 = drawCard()
      const draw2 = drawCard()
      drawnCards.push(draw1, draw2)

      const hand1 = makeHand([card1, draw1])
      const hand2 = makeHand([card2, draw2])

      if (isAceSplit) {
        // Ace split: each hand gets exactly one card, done immediately
        newState = {
          ...state,
          userHands: [
            { ...hand1, done: true },
            { ...hand2, done: true },
          ],
          activeUserHandIndex: 0,
          phase: 'ROUND_OVER',
        }
      } else {
        // Non-Ace split: play hand 1 first
        newState = {
          ...state,
          userHands: [hand1, hand2],
          activeUserHandIndex: 0,
          phase: hand1.done ? (hand2.done ? 'ROUND_OVER' : 'USER_CONTINUE') : 'USER_CONTINUE',
        }
        // If hand1 is already done (21 or bust), advance to hand2
        if (hand1.done && !hand2.done) {
          newState = { ...newState, activeUserHandIndex: 1 }
        }
      }
      break
    }
  }

  return { state: newState!, drawnCards }
}

/**
 * Apply a continue action (HIT/STAND) for the active user hand.
 */
export function applyContinueAction(
  state: RoundState,
  action: ContinueAction,
  drawCard: () => Card,
): UserActionResult {
  if (state.phase !== 'USER_CONTINUE') {
    throw new Error('Not in USER_CONTINUE phase')
  }

  const activeIdx = state.activeUserHandIndex
  const hand = state.userHands[activeIdx]!
  const drawnCards: Card[] = []

  // Determine correct action for feedback
  const correctAction = getCorrectActionForHand(
    hand.cards, state.dealerUpCard, false, false,
  )
  const correctContinue: ContinueAction =
    correctAction === 'HIT' || correctAction === 'DOUBLE' ? 'HIT' : 'STAND'

  let updatedHand: PlayerHand
  let feedbackCard: Card | null = null

  if (action === 'HIT') {
    const card = drawCard()
    drawnCards.push(card)
    feedbackCard = card
    const newCards = [...hand.cards, card]
    updatedHand = updateHand({ ...makeHand(newCards), doubled: hand.doubled })
  } else {
    // STAND
    updatedHand = { ...hand, done: true }
  }

  const newHands = [...state.userHands]
  newHands[activeIdx] = updatedHand

  const feedback: ContinueFeedback = {
    action,
    correctAction: correctContinue,
    card: feedbackCard,
  }

  // Determine next phase
  let nextPhase: RoundPhase = 'USER_CONTINUE'
  let nextActiveIdx = activeIdx

  if (updatedHand.done) {
    // Find next unfinished hand
    const nextUnfinished = newHands.findIndex((h, i) => i > activeIdx && !h.done)
    if (nextUnfinished >= 0) {
      nextActiveIdx = nextUnfinished
    } else {
      nextPhase = 'ROUND_OVER'
    }
  }

  return {
    state: {
      ...state,
      userHands: newHands,
      activeUserHandIndex: nextActiveIdx,
      phase: nextPhase,
      continueFeedback: [...state.continueFeedback, feedback],
    },
    drawnCards,
  }
}

// ============================================
// AI play
// ============================================

interface AiPlayResult {
  aiSeats: AiSeat[]
  drawnCards: Card[]
}

function playAiHand(
  hand: PlayerHand,
  dealerUpCard: Card,
  drawCard: () => Card,
  drawnCards: Card[],
): PlayerHand {
  let current = hand
  while (!current.done) {
    const action = getCorrectActionForHand(
      current.cards, dealerUpCard, false, false,
    )
    if (action === 'HIT' || action === 'DOUBLE') {
      const card = drawCard()
      drawnCards.push(card)
      const newCards = [...current.cards, card]
      current = updateHand({ ...makeHand(newCards), doubled: current.doubled })
    } else {
      current = { ...current, done: true }
    }
  }
  return current
}

function playAiSeat(
  seat: AiSeat,
  dealerUpCard: Card,
  drawCard: () => Card,
  drawnCards: Card[],
): AiSeat {
  const hand = seat.hands[0]!
  const cards = hand.cards

  // Check if AI should split (only 2 cards, same number)
  if (cards.length === 2 && cards[0]!.number === cards[1]!.number) {
    const action = getCorrectAction(cards as [Card, Card], dealerUpCard)
    if (action === 'SPLIT') {
      const isAceSplit = cards[0]!.number === 1
      const draw1 = drawCard()
      const draw2 = drawCard()
      drawnCards.push(draw1, draw2)

      let hand1 = makeHand([cards[0]!, draw1])
      let hand2 = makeHand([cards[1]!, draw2])

      if (isAceSplit) {
        hand1 = { ...hand1, done: true }
        hand2 = { ...hand2, done: true }
      } else {
        hand1 = playAiHand(hand1, dealerUpCard, drawCard, drawnCards)
        hand2 = playAiHand(hand2, dealerUpCard, drawCard, drawnCards)
      }
      return { hands: [hand1, hand2] }
    }
  }

  // Check if AI should double (only 2 cards)
  if (cards.length === 2) {
    const action = getCorrectAction(cards as [Card, Card], dealerUpCard)
    if (action === 'DOUBLE') {
      const card = drawCard()
      drawnCards.push(card)
      const newCards = [...cards, card]
      const hv = computeHandValue(newCards)
      return {
        hands: [{
          cards: newCards,
          total: hv.total,
          isSoft: hv.isSoft,
          busted: hv.total > 21,
          done: true,
          doubled: true,
        }],
      }
    }
  }

  // Normal play
  const played = playAiHand(hand, dealerUpCard, drawCard, drawnCards)
  return { hands: [played] }
}

export function playAllAi(
  aiSeats: AiSeat[],
  dealerUpCard: Card,
  drawCard: () => Card,
): AiPlayResult {
  const drawnCards: Card[] = []
  const newSeats = aiSeats.map(seat =>
    playAiSeat(seat, dealerUpCard, drawCard, drawnCards),
  )
  return { aiSeats: newSeats, drawnCards }
}

// ============================================
// Dealer play
// ============================================

export interface DealerPlayResult {
  drawnCards: Card[]
  dealerTotal: number
  dealerBusted: boolean
  holeCard: Card
}

/**
 * Play dealer's hand: reveal hole card, draw until 17+ (S17).
 */
export function playDealer(
  upCard: Card,
  holeCard: Card,
  drawCard: () => Card,
): DealerPlayResult {
  const drawnCards: Card[] = []
  const allCards = [upCard, holeCard]

  let hv = computeHandValue(allCards)

  // S17: stand on all 17+
  while (hv.total < 17) {
    const card = drawCard()
    drawnCards.push(card)
    allCards.push(card)
    hv = computeHandValue(allCards)
  }

  return {
    drawnCards,
    dealerTotal: hv.total,
    dealerBusted: hv.total > 21,
    holeCard,
  }
}

// ============================================
// Result determination
// ============================================

export function determineResult(
  playerTotal: number,
  playerBusted: boolean,
  dealerTotal: number,
  dealerBusted: boolean,
): RoundResult {
  if (playerBusted) return 'LOSE'
  if (dealerBusted) return 'WIN'
  if (playerTotal > dealerTotal) return 'WIN'
  if (playerTotal < dealerTotal) return 'LOSE'
  return 'PUSH'
}

// ============================================
// Full round resolution
// ============================================

/**
 * Resolve a round: play AI seats, play dealer, determine results.
 * Returns the fully resolved state and all newly visible cards.
 */
export function resolveRound(
  state: RoundState,
  drawCard: () => Card,
): { state: RoundState; drawnCards: Card[] } {
  if (state.phase !== 'ROUND_OVER') {
    throw new Error('Round is not ready to resolve')
  }

  const allDrawn: Card[] = []

  // Play AI seats
  const aiResult = playAllAi(state.aiSeats, state.dealerUpCard, drawCard)
  allDrawn.push(...aiResult.drawnCards)

  // Check if any non-busted user hands exist (if all busted, dealer doesn't play)
  const anyUserAlive = state.userHands.some(h => !h.busted)

  let dealerTotal: number
  let dealerBusted: boolean
  let dealerDrawn: Card[] = []

  if (anyUserAlive) {
    const dealerResult = playDealer(
      state.dealerUpCard, state.dealerHoleCard, drawCard,
    )
    dealerTotal = dealerResult.dealerTotal
    dealerBusted = dealerResult.dealerBusted
    dealerDrawn = dealerResult.drawnCards
    // Hole card becomes visible
    allDrawn.push(state.dealerHoleCard)
    allDrawn.push(...dealerDrawn)
  } else {
    // All user hands busted; dealer still reveals hole card
    const hv = computeHandValue([state.dealerUpCard, state.dealerHoleCard])
    dealerTotal = hv.total
    dealerBusted = hv.total > 21
    allDrawn.push(state.dealerHoleCard)
  }

  // Determine results for each user hand
  const userResults = state.userHands.map(hand =>
    determineResult(hand.total, hand.busted, dealerTotal, dealerBusted),
  )

  return {
    state: {
      ...state,
      aiSeats: aiResult.aiSeats,
      dealerDrawn,
      dealerTotal,
      dealerBusted,
      userResults,
    },
    drawnCards: allDrawn,
  }
}

/** Safety margin for reshuffle: (seatCount + 2) * 10 */
export function reshuffleSafetyMargin(aiSeatCount: number): number {
  return (aiSeatCount + 2) * 10
}
