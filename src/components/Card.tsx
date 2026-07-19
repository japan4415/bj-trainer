import { useId } from 'react'
import type { Card as CardType, Suit, CardNumber } from '../types'

// ============================================================
// Utility functions
// ============================================================

function getSuitColor(suit: Suit): string {
  return suit === 'H' || suit === 'D' ? '#d02020' : '#1a1a1a'
}

function getRankLabel(number: CardNumber): string {
  switch (number) {
    case 1: return 'A'
    case 11: return 'J'
    case 12: return 'Q'
    case 13: return 'K'
    default: return String(number)
  }
}

function getSuitSymbol(suit: Suit): string {
  switch (suit) {
    case 'H': return '♥'
    case 'D': return '♦'
    case 'S': return '♠'
    case 'C': return '♣'
  }
}

// ============================================================
// SuitShape -- SVG path definitions for each suit
// Centered at origin, base coordinate space ~28x28 (-14..+14)
// ============================================================

function SuitShape({ suit, fill }: { suit: Suit; fill: string }) {
  switch (suit) {
    case 'H':
      return (
        <path
          d="M0,12 C-1,10 -13,1 -13,-5 C-13,-11 -9,-14 -5,-14 C-2,-14 0,-10 0,-8 C0,-10 2,-14 5,-14 C9,-14 13,-11 13,-5 C13,1 1,10 0,12Z"
          fill={fill}
        />
      )
    case 'D':
      return <path d="M0,-14 L9,0 L0,14 L-9,0Z" fill={fill} />
    case 'S':
      return (
        <g fill={fill}>
          <path d="M0,-14 C-2,-8 -13,-1 -13,5 C-13,10 -8,13 -3,8 L0,10 L3,8 C8,13 13,10 13,5 C13,-1 2,-8 0,-14Z" />
          <path d="M-2.5,8 L-3.5,14 L3.5,14 L2.5,8Z" />
        </g>
      )
    case 'C':
      return (
        <g fill={fill}>
          <circle cx="0" cy="-6" r="6" />
          <circle cx="-6.5" cy="3" r="6" />
          <circle cx="6.5" cy="3" r="6" />
          <path d="M-2.5,4 L-3.5,14 L3.5,14 L2.5,4Z" />
        </g>
      )
  }
}

// ============================================================
// SuitPip -- renders a suit shape at (x, y) with given size
// ============================================================

interface SuitPipProps {
  suit: Suit
  x: number
  y: number
  size: number
  inverted?: boolean
}

function SuitPip({ suit, x, y, size, inverted }: SuitPipProps) {
  const color = getSuitColor(suit)
  const s = size / 28
  const rotation = inverted ? 180 : 0
  return (
    <g transform={`translate(${x},${y}) rotate(${rotation}) scale(${s})`}>
      <SuitShape suit={suit} fill={color} />
    </g>
  )
}

// ============================================================
// Pip layout for number cards (2-10)
// Coordinates within the pip area (x: ~92-164, y: ~95-267)
// ============================================================

interface PipPosition {
  x: number
  y: number
  inverted: boolean
}

const COL_L = 92
const COL_C = 128
const COL_R = 164

const PIP_LAYOUTS: Partial<Record<CardNumber, PipPosition[]>> = {
  2: [
    { x: COL_C, y: 105, inverted: false },
    { x: COL_C, y: 257, inverted: true },
  ],
  3: [
    { x: COL_C, y: 105, inverted: false },
    { x: COL_C, y: 181, inverted: false },
    { x: COL_C, y: 257, inverted: true },
  ],
  4: [
    { x: COL_L, y: 105, inverted: false },
    { x: COL_R, y: 105, inverted: false },
    { x: COL_L, y: 257, inverted: true },
    { x: COL_R, y: 257, inverted: true },
  ],
  5: [
    { x: COL_L, y: 105, inverted: false },
    { x: COL_R, y: 105, inverted: false },
    { x: COL_C, y: 181, inverted: false },
    { x: COL_L, y: 257, inverted: true },
    { x: COL_R, y: 257, inverted: true },
  ],
  6: [
    { x: COL_L, y: 105, inverted: false },
    { x: COL_R, y: 105, inverted: false },
    { x: COL_L, y: 181, inverted: false },
    { x: COL_R, y: 181, inverted: false },
    { x: COL_L, y: 257, inverted: true },
    { x: COL_R, y: 257, inverted: true },
  ],
  7: [
    { x: COL_L, y: 105, inverted: false },
    { x: COL_R, y: 105, inverted: false },
    { x: COL_L, y: 181, inverted: false },
    { x: COL_R, y: 181, inverted: false },
    { x: COL_C, y: 143, inverted: false },
    { x: COL_L, y: 257, inverted: true },
    { x: COL_R, y: 257, inverted: true },
  ],
  8: [
    { x: COL_L, y: 105, inverted: false },
    { x: COL_R, y: 105, inverted: false },
    { x: COL_L, y: 181, inverted: false },
    { x: COL_R, y: 181, inverted: false },
    { x: COL_C, y: 143, inverted: false },
    { x: COL_C, y: 219, inverted: true },
    { x: COL_L, y: 257, inverted: true },
    { x: COL_R, y: 257, inverted: true },
  ],
  9: [
    { x: COL_L, y: 97, inverted: false },
    { x: COL_R, y: 97, inverted: false },
    { x: COL_L, y: 151, inverted: false },
    { x: COL_R, y: 151, inverted: false },
    { x: COL_C, y: 181, inverted: false },
    { x: COL_L, y: 211, inverted: true },
    { x: COL_R, y: 211, inverted: true },
    { x: COL_L, y: 265, inverted: true },
    { x: COL_R, y: 265, inverted: true },
  ],
  10: [
    { x: COL_L, y: 97, inverted: false },
    { x: COL_R, y: 97, inverted: false },
    { x: COL_L, y: 151, inverted: false },
    { x: COL_R, y: 151, inverted: false },
    { x: COL_C, y: 124, inverted: false },
    { x: COL_C, y: 238, inverted: true },
    { x: COL_L, y: 211, inverted: true },
    { x: COL_R, y: 211, inverted: true },
    { x: COL_L, y: 265, inverted: true },
    { x: COL_R, y: 265, inverted: true },
  ],
}

const PIP_SIZE = 30

// ============================================================
// Face card palette (Bicycle-inspired multicolor)
// ============================================================

const FC = {
  gold:      '#f0c040',
  goldDk:    '#c8a020',
  skin:      '#f5d0a0',
  skinDk:    '#d4a870',
  hair:      '#3a2a1a',
  robeRed:   '#c03030',
  robeBlue:  '#2040a0',
  white:     '#ffffff',
  black:     '#1a1a1a',
  green:     '#2a8020',
  jewel:     '#d02020',
  jewelBlue: '#2060c0',
  cardBg:    '#f8f4e8',
  border:    '#cccccc',
} as const

// ============================================================
// Court card frame (double border, Bicycle-style)
// Outer: y=56..306, Inner: y=62..300
// ============================================================

function CourtCardFrame() {
  return (
    <>
      <rect x="36" y="56" width="184" height="250" rx="6" ry="6"
        fill="none" stroke={FC.goldDk} strokeWidth="2.5" />
      <rect x="42" y="62" width="172" height="238" rx="4" ry="4"
        fill="none" stroke={FC.goldDk} strokeWidth="1" />
    </>
  )
}

// ============================================================
// King upper-half figure
// All elements within y=56..181 (clipped by CourtFigure)
// ============================================================

function KingUpper() {
  return (
    <g>
      <rect x="43" y="63" width="170" height="118" fill={FC.cardBg} />

      {/* Crown with jewels */}
      <path d="M104,80 L110,68 L118,82 L128,64 L138,82 L146,68 L152,80 L152,90 L104,90Z"
        fill={FC.gold} stroke={FC.goldDk} strokeWidth="1.2" />
      <circle cx="128" cy="73" r="3" fill={FC.jewel} />
      <circle cx="115" cy="79" r="2" fill={FC.jewelBlue} />
      <circle cx="141" cy="79" r="2" fill={FC.jewelBlue} />

      {/* Face */}
      <circle cx="128" cy="104" r="13" fill={FC.skin} stroke={FC.skinDk} strokeWidth="1" />
      <circle cx="123" cy="101" r="2" fill={FC.black} />
      <circle cx="133" cy="101" r="2" fill={FC.black} />
      <path d="M126,107 L128,109 L130,107" fill="none" stroke={FC.skinDk} strokeWidth="1" />

      {/* Beard and mustache */}
      <path d="M119,112 C119,124 128,128 128,128 C128,128 137,124 137,112"
        fill={FC.hair} />
      <path d="M121,110 C124,113 128,110 128,110 C128,110 132,113 135,110"
        fill={FC.hair} />

      {/* Robe with collar */}
      <path d="M96,128 L112,120 L128,130 L144,120 L160,128 L160,181 L96,181Z"
        fill={FC.robeRed} stroke={FC.black} strokeWidth="1" />
      <path d="M116,120 L128,132 L140,120"
        fill={FC.gold} stroke={FC.goldDk} strokeWidth="0.8" />

      {/* Scepter (right side, orb + shaft) */}
      <line x1="160" y1="80" x2="160" y2="178"
        stroke={FC.gold} strokeWidth="3.5" />
      <circle cx="160" cy="76" r="5.5"
        fill={FC.gold} stroke={FC.goldDk} strokeWidth="1" />
      <circle cx="160" cy="76" r="2.5" fill={FC.jewel} />
    </g>
  )
}

// ============================================================
// Queen upper-half figure
// All elements within y=56..181 (clipped by CourtFigure)
// ============================================================

function QueenUpper() {
  return (
    <g>
      <rect x="43" y="63" width="170" height="118" fill={FC.cardBg} />

      {/* Crown */}
      <path d="M108,82 L114,70 L121,80 L128,66 L135,80 L142,70 L148,82 L148,90 L108,90Z"
        fill={FC.gold} stroke={FC.goldDk} strokeWidth="1.2" />
      <circle cx="128" cy="74" r="3" fill={FC.jewel} />

      {/* Hair */}
      <path d="M112,94 C110,90 108,96 106,112 L114,100Z" fill={FC.hair} />
      <path d="M144,94 C146,90 148,96 150,112 L142,100Z" fill={FC.hair} />

      {/* Face */}
      <circle cx="128" cy="104" r="12" fill={FC.skin} stroke={FC.skinDk} strokeWidth="1" />
      <ellipse cx="123" cy="101" rx="2.5" ry="1.8" fill={FC.black} />
      <ellipse cx="133" cy="101" rx="2.5" ry="1.8" fill={FC.black} />
      <path d="M124,109 C126,112 130,112 132,109"
        fill={FC.jewel} stroke={FC.jewel} strokeWidth="0.8" />

      {/* Dress with necklace */}
      <path d="M98,124 L116,118 L128,126 L140,118 L158,124 L162,181 L94,181Z"
        fill={FC.robeBlue} stroke={FC.black} strokeWidth="1" />
      <circle cx="128" cy="120" r="3"
        fill={FC.gold} stroke={FC.goldDk} strokeWidth="0.5" />

      {/* Flower with stem */}
      <g transform="translate(96,142)">
        <circle cx="0" cy="-5" r="3.5" fill={FC.jewel} />
        <circle cx="-4.5" cy="-1" r="3.5" fill={FC.jewel} />
        <circle cx="-3.5" cy="4" r="3.5" fill={FC.jewel} />
        <circle cx="3.5" cy="4" r="3.5" fill={FC.jewel} />
        <circle cx="4.5" cy="-1" r="3.5" fill={FC.jewel} />
        <circle cx="0" cy="0" r="2.5" fill={FC.gold} />
        <line x1="0" y1="7" x2="0" y2="28"
          stroke={FC.green} strokeWidth="2" />
        <path d="M0,16 C-4,12 -7,14 -9,13"
          fill="none" stroke={FC.green} strokeWidth="1.5" />
      </g>
    </g>
  )
}

// ============================================================
// Jack upper-half figure
// All elements within y=56..181 (clipped by CourtFigure)
// ============================================================

function JackUpper() {
  return (
    <g>
      <rect x="43" y="63" width="170" height="118" fill={FC.cardBg} />

      {/* Tall hat */}
      <path d="M112,94 L114,70 C116,62 128,57 128,57 C128,57 140,62 142,70 L144,94Z"
        fill={FC.robeRed} stroke={FC.black} strokeWidth="1" />
      {/* Hat brim */}
      <path d="M108,94 L148,94 L146,98 L110,98Z"
        fill={FC.gold} stroke={FC.goldDk} strokeWidth="0.5" />
      {/* Feather (behind hat, curving up-right from upper hat edge) */}
      <path d="M140,64 C148,58 155,57 158,60 C154,61 147,63 142,66"
        fill={FC.robeBlue} stroke={FC.black} strokeWidth="0.5" />

      {/* Face */}
      <circle cx="128" cy="110" r="12"
        fill={FC.skin} stroke={FC.skinDk} strokeWidth="1" />
      <circle cx="124" cy="107" r="1.8" fill={FC.black} />
      <circle cx="132" cy="107" r="1.8" fill={FC.black} />
      <path d="M125,114 C127,117 129,117 131,114"
        fill="none" stroke={FC.skinDk} strokeWidth="1" />

      {/* Ruffled collar */}
      <path d="M110,124 C115,130 120,122 125,128 C128,122 131,128 135,122 C140,128 145,124 148,124"
        fill={FC.white} stroke={FC.border} strokeWidth="1" />

      {/* Vest with gold trim and buttons */}
      <path d="M100,128 L120,124 L128,132 L136,124 L156,128 L160,181 L96,181Z"
        fill={FC.robeBlue} stroke={FC.black} strokeWidth="1" />
      <line x1="128" y1="132" x2="128" y2="181"
        stroke={FC.gold} strokeWidth="3" />
      <circle cx="128" cy="144" r="2.5"
        fill={FC.gold} stroke={FC.goldDk} strokeWidth="0.5" />
      <circle cx="128" cy="158" r="2.5"
        fill={FC.gold} stroke={FC.goldDk} strokeWidth="0.5" />
      <circle cx="128" cy="172" r="2.5"
        fill={FC.gold} stroke={FC.goldDk} strokeWidth="0.5" />
    </g>
  )
}

// ============================================================
// CourtFigure -- clipPath + upper/lower mirror + suit pips
// clipPath ensures each half is strictly within its area,
// producing clean point-symmetric court card illustrations.
// ============================================================

function CourtFigure({ suit, number }: { suit: Suit; number: 11 | 12 | 13 }) {
  const clipId = useId()
  const Figure = number === 13 ? KingUpper
    : number === 12 ? QueenUpper
    : JackUpper

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x="36" y="56" width="184" height="125" />
        </clipPath>
      </defs>

      {/* Upper half (clipped to y=56..181) */}
      <g clipPath={`url(#${clipId})`}>
        <Figure />
      </g>

      {/* Lower half (clipped in local coords, then rotated 180 degrees) */}
      <g transform="rotate(180, 128, 181)">
        <g clipPath={`url(#${clipId})`}>
          <Figure />
        </g>
      </g>

      {/* Center dividing line */}
      <line x1="43" y1="181" x2="213" y2="181"
        stroke={FC.goldDk} strokeWidth="1" />

      {/* Suit pips inside the frame */}
      <SuitPip suit={suit} x={52} y={74} size={14} />
      <SuitPip suit={suit} x={204} y={288} size={14} inverted />
    </>
  )
}

// ============================================================
// Corner index (rank text + suit pip)
// ============================================================

function CornerIndex({ rank, suit, color }: {
  rank: string
  suit: Suit
  color: string
}) {
  const fontSize = rank === '10' ? 26 : 30
  return (
    <g>
      <text x="20" y="44" fontSize={fontSize} fontWeight="bold" fill={color}
        textAnchor="middle" fontFamily="Arial, sans-serif">
        {rank}
      </text>
      <SuitPip suit={suit} x={20} y={62} size={16} />
    </g>
  )
}

// ============================================================
// PlayingCard (main component)
// ============================================================

interface PlayingCardProps {
  card: CardType
  /** Stagger index for deal-in animation; undefined = no animation */
  dealIndex?: number
}

export function PlayingCard({ card, dealIndex }: PlayingCardProps) {
  const color = getSuitColor(card.suit)
  const rank = getRankLabel(card.number)
  const symbol = getSuitSymbol(card.suit)

  const isAce = card.number === 1
  const isFaceCard = card.number >= 11 && card.number <= 13
  const isNumberCard = card.number >= 2 && card.number <= 10

  return (
    <svg
      viewBox="0 0 256 362"
      className={`playing-card${dealIndex !== undefined ? ' card-deal' : ''}`}
      style={dealIndex !== undefined ? { '--deal-index': dealIndex } as React.CSSProperties : undefined}
      aria-label={`${rank}${symbol}`}
    >
      {/* Card background */}
      <rect x="1" y="1" width="254" height="360" rx="15" ry="15"
        fill="white" stroke="#ccc" strokeWidth="2" />

      {/* Top-left corner index */}
      <CornerIndex rank={rank} suit={card.suit} color={color} />

      {/* Bottom-right corner index (rotated 180 degrees) */}
      <g transform="rotate(180, 128, 181)">
        <CornerIndex rank={rank} suit={card.suit} color={color} />
      </g>

      {/* Ace: large center pip */}
      {isAce && (
        <SuitPip suit={card.suit} x={128} y={181} size={60} />
      )}

      {/* Number cards (2-10): standard pip layout */}
      {isNumberCard && PIP_LAYOUTS[card.number]?.map((pip) => (
        <SuitPip
          key={`${pip.x}-${pip.y}`}
          suit={card.suit}
          x={pip.x}
          y={pip.y}
          size={PIP_SIZE}
          inverted={pip.inverted}
        />
      ))}

      {/* Face cards (J/Q/K): court illustrations */}
      {isFaceCard && (
        <>
          <CourtCardFrame />
          <CourtFigure suit={card.suit} number={card.number as 11 | 12 | 13} />
        </>
      )}
    </svg>
  )
}

// ============================================================
// CardBack
// ============================================================

interface CardBackProps {
  /** Stagger index for deal-in animation; undefined = no animation */
  dealIndex?: number
}

export function CardBack({ dealIndex }: CardBackProps) {
  return (
    <svg
      viewBox="0 0 256 362"
      className={`playing-card${dealIndex !== undefined ? ' card-deal' : ''}`}
      style={dealIndex !== undefined ? { '--deal-index': dealIndex } as React.CSSProperties : undefined}
      aria-label="Face-down card"
    >
      {/* Card border */}
      <rect x="1" y="1" width="254" height="360" rx="15" ry="15"
        fill="#1a237e" stroke="#ccc" strokeWidth="2" />
      {/* Inner border */}
      <rect x="12" y="12" width="232" height="338" rx="10" ry="10"
        fill="none" stroke="#ffd700" strokeWidth="2" />
      {/* Diamond pattern */}
      <defs>
        <pattern id="cardBackPattern" x="0" y="0" width="24" height="24"
          patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="24" height="24" fill="#1a237e" />
          <rect x="0" y="0" width="12" height="12" fill="#283593" />
          <rect x="12" y="12" width="12" height="12" fill="#283593" />
        </pattern>
      </defs>
      <rect x="18" y="18" width="220" height="326" rx="8" ry="8"
        fill="url(#cardBackPattern)" />
      {/* Center diamond */}
      <polygon points="128,100 168,181 128,262 88,181"
        fill="none" stroke="#ffd700" strokeWidth="2" />
      <polygon points="128,130 148,181 128,232 108,181"
        fill="#ffd700" opacity="0.3" />
    </svg>
  )
}
