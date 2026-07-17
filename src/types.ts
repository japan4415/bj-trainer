export type Suit = 'H' | 'D' | 'S' | 'C'

/** Card number: 1=A, 2-10, 11=J, 12=Q, 13=K */
export type CardNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13

export interface Card {
  suit: Suit
  number: CardNumber
}

export type Action = 'HIT' | 'STAND' | 'DOUBLE' | 'SPLIT'

export type HandType = 'HARD' | 'SOFT' | 'PAIR'
