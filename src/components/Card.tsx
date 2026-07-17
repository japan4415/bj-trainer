import type { Card as CardType, Suit, CardNumber } from '../types'

function getSuitSymbol(suit: Suit): string {
  switch (suit) {
    case 'H': return '♥' // Hearts
    case 'D': return '♦' // Diamonds
    case 'S': return '♠' // Spades
    case 'C': return '♣' // Clubs
  }
}

function getSuitColor(suit: Suit): string {
  return suit === 'H' || suit === 'D' ? '#d00' : '#000'
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

interface PlayingCardProps {
  card: CardType
}

export function PlayingCard({ card }: PlayingCardProps) {
  const symbol = getSuitSymbol(card.suit)
  const color = getSuitColor(card.suit)
  const rank = getRankLabel(card.number)

  return (
    <svg
      viewBox="0 0 256 362"
      className="playing-card"
      aria-label={`${rank}${symbol}`}
    >
      {/* Card background */}
      <rect x="1" y="1" width="254" height="360" rx="15" ry="15"
        fill="white" stroke="#ccc" strokeWidth="2" />

      {/* Top-left rank */}
      <text x="18" y="48" fontSize="36" fontWeight="bold" fill={color}
        textAnchor="middle" fontFamily="Arial, sans-serif">
        {rank}
      </text>
      {/* Top-left suit */}
      <text x="18" y="78" fontSize="28" fill={color}
        textAnchor="middle" fontFamily="Arial, sans-serif">
        {symbol}
      </text>

      {/* Center suit symbol */}
      <text x="128" y="200" fontSize="80" fill={color}
        textAnchor="middle" dominantBaseline="middle" fontFamily="Arial, sans-serif">
        {symbol}
      </text>

      {/* Bottom-right rank (rotated) */}
      <g transform="rotate(180, 128, 181)">
        <text x="18" y="48" fontSize="36" fontWeight="bold" fill={color}
          textAnchor="middle" fontFamily="Arial, sans-serif">
          {rank}
        </text>
        <text x="18" y="78" fontSize="28" fill={color}
          textAnchor="middle" fontFamily="Arial, sans-serif">
          {symbol}
        </text>
      </g>
    </svg>
  )
}

export function CardBack() {
  return (
    <svg
      viewBox="0 0 256 362"
      className="playing-card"
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
