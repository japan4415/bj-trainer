import { describe, it, expect } from 'vitest'
import { getCorrectAction, classifyHand, getCardValue } from './strategy'
import type { Card } from './types'

function card(suit: Card['suit'], number: Card['number']): Card {
  return { suit, number }
}

describe('getCardValue', () => {
  it('returns 11 for Ace', () => {
    expect(getCardValue(1)).toBe(11)
  })

  it('returns face value for 2-9', () => {
    expect(getCardValue(5)).toBe(5)
    expect(getCardValue(9)).toBe(9)
  })

  it('returns 10 for 10, J, Q, K', () => {
    expect(getCardValue(10)).toBe(10)
    expect(getCardValue(11)).toBe(10)
    expect(getCardValue(12)).toBe(10)
    expect(getCardValue(13)).toBe(10)
  })
})

describe('classifyHand', () => {
  it('classifies pair of same number', () => {
    const result = classifyHand(card('H', 7), card('S', 7))
    expect(result.type).toBe('PAIR')
    expect(result.key).toBe(7)
  })

  it('classifies A-A as pair with key 11', () => {
    const result = classifyHand(card('H', 1), card('S', 1))
    expect(result.type).toBe('PAIR')
    expect(result.key).toBe(11)
  })

  it('does NOT classify J+Q as pair (different numbers)', () => {
    const result = classifyHand(card('H', 11), card('S', 12))
    expect(result.type).toBe('HARD')
    expect(result.key).toBe(20) // 10 + 10
  })

  it('classifies J+J as pair', () => {
    const result = classifyHand(card('H', 11), card('S', 11))
    expect(result.type).toBe('PAIR')
    expect(result.key).toBe(10)
  })

  it('classifies soft hand (one Ace)', () => {
    const result = classifyHand(card('H', 1), card('S', 6))
    expect(result.type).toBe('SOFT')
    expect(result.key).toBe(6)
  })

  it('classifies soft hand with Ace as second card', () => {
    const result = classifyHand(card('D', 8), card('C', 1))
    expect(result.type).toBe('SOFT')
    expect(result.key).toBe(8)
  })

  it('classifies soft hand with face card', () => {
    const result = classifyHand(card('H', 1), card('S', 13))
    expect(result.type).toBe('SOFT')
    expect(result.key).toBe(10) // K value = 10
  })

  it('classifies hard hand', () => {
    const result = classifyHand(card('H', 9), card('S', 5))
    expect(result.type).toBe('HARD')
    expect(result.key).toBe(14)
  })

  it('classifies hard hand with face cards', () => {
    const result = classifyHand(card('H', 13), card('S', 4))
    expect(result.type).toBe('HARD')
    expect(result.key).toBe(14) // K(10) + 4
  })
})

describe('getCorrectAction', () => {
  // Hard hands
  it('returns HIT for hard 8 vs dealer 5', () => {
    expect(getCorrectAction(
      [card('H', 3), card('S', 5)],
      card('D', 5),
    )).toBe('HIT')
  })

  it('returns DOUBLE for hard 9 vs dealer 3', () => {
    expect(getCorrectAction(
      [card('H', 4), card('S', 5)],
      card('D', 3),
    )).toBe('DOUBLE')
  })

  it('returns HIT for hard 9 vs dealer 2', () => {
    expect(getCorrectAction(
      [card('H', 4), card('S', 5)],
      card('D', 2),
    )).toBe('HIT')
  })

  it('returns DOUBLE for hard 10 vs dealer 7', () => {
    expect(getCorrectAction(
      [card('H', 4), card('S', 6)],
      card('D', 7),
    )).toBe('DOUBLE')
  })

  it('returns HIT for hard 10 vs dealer 10', () => {
    expect(getCorrectAction(
      [card('H', 4), card('S', 6)],
      card('D', 10),
    )).toBe('HIT')
  })

  it('returns DOUBLE for hard 11 vs dealer A', () => {
    expect(getCorrectAction(
      [card('H', 5), card('S', 6)],
      card('D', 1),
    )).toBe('DOUBLE')
  })

  it('returns STAND for hard 12 vs dealer 4', () => {
    expect(getCorrectAction(
      [card('H', 5), card('S', 7)],
      card('D', 4),
    )).toBe('STAND')
  })

  it('returns HIT for hard 12 vs dealer 2', () => {
    expect(getCorrectAction(
      [card('H', 5), card('S', 7)],
      card('D', 2),
    )).toBe('HIT')
  })

  it('returns STAND for hard 15 vs dealer 5', () => {
    expect(getCorrectAction(
      [card('H', 8), card('S', 7)],
      card('D', 5),
    )).toBe('STAND')
  })

  it('returns HIT for hard 15 vs dealer 7', () => {
    expect(getCorrectAction(
      [card('H', 8), card('S', 7)],
      card('D', 7),
    )).toBe('HIT')
  })

  it('returns STAND for hard 17 vs any dealer', () => {
    expect(getCorrectAction(
      [card('H', 7), card('S', 13)], // 7 + K = 17
      card('D', 1), // Ace
    )).toBe('STAND')
  })

  // Soft hands
  it('returns HIT for A-5 vs dealer 2', () => {
    expect(getCorrectAction(
      [card('H', 1), card('S', 5)],
      card('D', 2),
    )).toBe('HIT')
  })

  it('returns DOUBLE for A-5 vs dealer 4', () => {
    expect(getCorrectAction(
      [card('H', 1), card('S', 5)],
      card('D', 4),
    )).toBe('DOUBLE')
  })

  it('returns STAND for A-7 vs dealer 2', () => {
    expect(getCorrectAction(
      [card('H', 1), card('S', 7)],
      card('D', 2),
    )).toBe('STAND')
  })

  it('returns DOUBLE for A-7 vs dealer 3', () => {
    expect(getCorrectAction(
      [card('H', 1), card('S', 7)],
      card('D', 3),
    )).toBe('DOUBLE')
  })

  it('returns HIT for A-7 vs dealer 9', () => {
    expect(getCorrectAction(
      [card('H', 1), card('S', 7)],
      card('D', 9),
    )).toBe('HIT')
  })

  it('returns STAND for A-8 vs dealer 6', () => {
    expect(getCorrectAction(
      [card('H', 1), card('S', 8)],
      card('D', 6),
    )).toBe('STAND')
  })

  it('returns STAND for A-K vs any dealer', () => {
    expect(getCorrectAction(
      [card('H', 1), card('S', 13)],
      card('D', 5),
    )).toBe('STAND')
  })

  // Pair hands
  it('returns SPLIT for 8-8 vs any dealer', () => {
    expect(getCorrectAction(
      [card('H', 8), card('S', 8)],
      card('D', 1),
    )).toBe('SPLIT')
  })

  it('returns SPLIT for A-A vs any dealer', () => {
    expect(getCorrectAction(
      [card('H', 1), card('S', 1)],
      card('D', 10),
    )).toBe('SPLIT')
  })

  it('returns STAND for 10-10 vs any dealer', () => {
    expect(getCorrectAction(
      [card('H', 10), card('S', 10)],
      card('D', 5),
    )).toBe('STAND')
  })

  it('returns STAND for K-K vs any dealer', () => {
    expect(getCorrectAction(
      [card('H', 13), card('S', 13)],
      card('D', 5),
    )).toBe('STAND')
  })

  it('returns SPLIT for 2-2 vs dealer 4', () => {
    expect(getCorrectAction(
      [card('H', 2), card('S', 2)],
      card('D', 4),
    )).toBe('SPLIT')
  })

  it('returns HIT for 2-2 vs dealer 2', () => {
    expect(getCorrectAction(
      [card('H', 2), card('S', 2)],
      card('D', 2),
    )).toBe('HIT')
  })

  it('returns DOUBLE for 5-5 vs dealer 6', () => {
    expect(getCorrectAction(
      [card('H', 5), card('S', 5)],
      card('D', 6),
    )).toBe('DOUBLE')
  })

  it('returns HIT for 5-5 vs dealer A', () => {
    expect(getCorrectAction(
      [card('H', 5), card('S', 5)],
      card('D', 1),
    )).toBe('HIT')
  })

  it('returns SPLIT for 9-9 vs dealer 9', () => {
    expect(getCorrectAction(
      [card('H', 9), card('S', 9)],
      card('D', 9),
    )).toBe('SPLIT')
  })

  it('returns STAND for 9-9 vs dealer 7', () => {
    expect(getCorrectAction(
      [card('H', 9), card('S', 9)],
      card('D', 7),
    )).toBe('STAND')
  })

  it('returns STAND for 9-9 vs dealer A', () => {
    expect(getCorrectAction(
      [card('H', 9), card('S', 9)],
      card('D', 1),
    )).toBe('STAND')
  })

  // Dealer face card mapping
  it('treats dealer J as 10 column', () => {
    expect(getCorrectAction(
      [card('H', 8), card('S', 7)], // hard 15
      card('D', 11), // J -> 10 column
    )).toBe('HIT')
  })

  it('treats dealer Q as 10 column', () => {
    expect(getCorrectAction(
      [card('H', 8), card('S', 7)], // hard 15
      card('D', 12), // Q -> 10 column
    )).toBe('HIT')
  })

  it('treats dealer K as 10 column', () => {
    expect(getCorrectAction(
      [card('H', 8), card('S', 7)], // hard 15
      card('D', 13), // K -> 10 column
    )).toBe('HIT')
  })

  // Edge case: example from explanation page
  it('returns STAND for dealer 2, player 4+K (hard 14)', () => {
    expect(getCorrectAction(
      [card('C', 4), card('H', 13)], // 4 + K = 14
      card('D', 2), // dealer 2
    )).toBe('STAND')
  })
})
