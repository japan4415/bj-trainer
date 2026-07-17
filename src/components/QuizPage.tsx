import { useState, useCallback, useEffect, useRef } from 'react'
import type { Card as CardType, Action } from '../types'
import { PlayingCard, CardBack } from './Card'
import { HighlightedStrategyTable } from './StrategyTable'
import { getCorrectAction, getStrategyLookup } from '../strategy'
import { getActionEVs } from '../ev'
import { createShoe, getRecommendedBet } from '../shoe'
import type { Shoe, BetLevel, DealResult } from '../shoe'

interface QuizState {
  dealerCard: CardType
  playerCards: [CardType, CardType]
  answered: boolean
  selectedAction: Action | null
  correctAction: Action
  isCorrect: boolean | null
  preDealCount: number
  currentCount: number
  shuffled: boolean
  remaining: number
  /** Bet level locked in at deal time (before seeing cards) */
  lockedBetLevel: BetLevel
}

interface CumulativeEV {
  count: number
  totalSelectedEV: number
  totalOptimalEV: number
}

interface BetStats {
  total: number
  correct: number
}

interface EVInfo {
  actionEVs: Record<Action, number | null>
  selectedEV: number | null
  optimalAction: Action
  optimalEV: number
  evDiff: number | null
  splitUnavailable: boolean
}

const BET_STORAGE_KEY = 'bj-trainer-bet-level'

function loadBetLevel(): BetLevel {
  try {
    const stored = localStorage.getItem(BET_STORAGE_KEY)
    if (stored === 'normal' || stored === 'x2') return stored
  } catch {
    // localStorage unavailable
  }
  return 'normal'
}

function saveBetLevel(level: BetLevel): void {
  try {
    localStorage.setItem(BET_STORAGE_KEY, level)
  } catch {
    // localStorage unavailable
  }
}

function createQuizStateFromDeal(deal: DealResult, betLevel: BetLevel): QuizState {
  const correctAction = getCorrectAction(deal.playerCards, deal.dealerCard)
  return {
    dealerCard: deal.dealerCard,
    playerCards: deal.playerCards,
    answered: false,
    selectedAction: null,
    correctAction,
    isCorrect: null,
    preDealCount: deal.preDealCount,
    currentCount: deal.currentCount,
    shuffled: deal.shuffled,
    remaining: deal.remaining,
    lockedBetLevel: betLevel,
  }
}

function getActionLabel(action: Action): string {
  switch (action) {
    case 'HIT': return 'Hit'
    case 'STAND': return 'Stand'
    case 'DOUBLE': return 'Double'
    case 'SPLIT': return 'Split'
  }
}

function formatEV(ev: number): string {
  const sign = ev >= 0 ? '+' : ''
  return `${sign}${ev.toFixed(3)}`
}

function formatCount(count: number): string {
  const sign = count > 0 ? '+' : ''
  return `${sign}${count}`
}

function computeEVInfo(
  playerCards: [CardType, CardType],
  dealerCard: CardType,
  selectedAction: Action,
): EVInfo {
  const actionEVs = getActionEVs(playerCards, dealerCard)

  // Find optimal action (argmax of non-null EVs)
  let optimalAction: Action = 'HIT'
  let optimalEV = -Infinity
  for (const [action, ev] of Object.entries(actionEVs) as [Action, number | null][]) {
    if (ev !== null && ev > optimalEV) {
      optimalEV = ev
      optimalAction = action
    }
  }

  const selectedEVRaw = actionEVs[selectedAction]
  const splitUnavailable = selectedAction === 'SPLIT' && selectedEVRaw === null

  // For unavailable SPLIT: use the minimum valid EV
  let selectedEV: number | null
  if (splitUnavailable) {
    let minEV = Infinity
    for (const ev of Object.values(actionEVs)) {
      if (ev !== null && ev < minEV) {
        minEV = ev
      }
    }
    selectedEV = minEV === Infinity ? null : minEV
  } else {
    selectedEV = selectedEVRaw
  }

  const evDiff = selectedEV !== null ? selectedEV - optimalEV : null

  return { actionEVs, selectedEV, optimalAction, optimalEV, evDiff, splitUnavailable }
}

export function QuizPage() {
  const shoeRef = useRef<Shoe | null>(null)
  const initialDealRef = useRef<DealResult | null>(null)
  if (shoeRef.current === null) {
    shoeRef.current = createShoe()
    initialDealRef.current = shoeRef.current.deal()
  }
  const [quiz, setQuiz] = useState<QuizState>(() => createQuizStateFromDeal(initialDealRef.current!, loadBetLevel()))
  const [showTable, setShowTable] = useState(false)
  const [evInfo, setEVInfo] = useState<EVInfo | null>(null)
  // nextBetLevel: what the user selects for the NEXT hand (via toggle shown after answering)
  const [nextBetLevel, setNextBetLevel] = useState<BetLevel>(loadBetLevel)
  const cumulativeRef = useRef<CumulativeEV>({ count: 0, totalSelectedEV: 0, totalOptimalEV: 0 })
  const [cumulative, setCumulative] = useState<CumulativeEV>({ count: 0, totalSelectedEV: 0, totalOptimalEV: 0 })
  const betStatsRef = useRef<BetStats>({ total: 0, correct: 0 })
  const [betStats, setBetStats] = useState<BetStats>({ total: 0, correct: 0 })

  useEffect(() => {
    document.title = 'トレーニング'
  }, [])

  const handleNextBetToggle = useCallback((level: BetLevel) => {
    setNextBetLevel(level)
    saveBetLevel(level)
  }, [])

  const handleAnswer = useCallback((action: Action) => {
    if (quiz.answered) return

    const info = computeEVInfo(quiz.playerCards, quiz.dealerCard, action)
    setEVInfo(info)

    // Use the locked bet level (fixed at deal time) for EV scaling and bet judgment
    const betMultiplier = quiz.lockedBetLevel === 'x2' ? 2 : 1

    // Update cumulative (count always increments; EV sums only when available)
    const newCumulative: CumulativeEV = {
      count: cumulativeRef.current.count + 1,
      totalSelectedEV: cumulativeRef.current.totalSelectedEV + (info.selectedEV !== null ? info.selectedEV * betMultiplier : 0),
      totalOptimalEV: cumulativeRef.current.totalOptimalEV + info.optimalEV * betMultiplier,
    }
    cumulativeRef.current = newCumulative
    setCumulative(newCumulative)

    // Update bet stats using the locked bet level
    const recommendedBet = getRecommendedBet(quiz.preDealCount)
    const betCorrect = quiz.lockedBetLevel === recommendedBet
    const newBetStats: BetStats = {
      total: betStatsRef.current.total + 1,
      correct: betStatsRef.current.correct + (betCorrect ? 1 : 0),
    }
    betStatsRef.current = newBetStats
    setBetStats(newBetStats)

    setQuiz((prev) => ({
      ...prev,
      answered: true,
      selectedAction: action,
      isCorrect: action === prev.correctAction,
    }))
  }, [quiz.playerCards, quiz.dealerCard, quiz.answered, quiz.preDealCount, quiz.lockedBetLevel])

  const handleRetry = useCallback(() => {
    const deal = shoeRef.current!.deal()
    // Lock in the current nextBetLevel for the new hand
    setQuiz(createQuizStateFromDeal(deal, nextBetLevel))
    setShowTable(false)
    setEVInfo(null)
  }, [nextBetLevel])

  const handleToggleTable = useCallback(() => {
    setShowTable((prev) => !prev)
  }, [])

  const recommendedBet = getRecommendedBet(quiz.preDealCount)
  const betCorrect = quiz.lockedBetLevel === recommendedBet

  return (
    <div className="quiz-page">
      {/* Shuffle notification */}
      {quiz.shuffled && (
        <div className="shuffle-notification">
          シャッフルしました（カウントリセット）
        </div>
      )}

      {/* Dealer section */}
      <div className="hand-section">
        <h2 className="hand-label">Dealer</h2>
        <div className="card-row">
          <PlayingCard card={quiz.dealerCard} />
          <CardBack />
        </div>
      </div>

      {/* Player section */}
      <div className="hand-section">
        <h2 className="hand-label">You</h2>
        <div className="card-row">
          <PlayingCard card={quiz.playerCards[0]} />
          <PlayingCard card={quiz.playerCards[1]} />
        </div>
      </div>

      {/* Result display */}
      {quiz.answered && (
        <div className="result-area">
          {quiz.isCorrect ? (
            <p className="result-text"><strong>Correct!</strong></p>
          ) : (
            <p className="result-text">
              <strong>Incorrect. {getActionLabel(quiz.correctAction)} is better.</strong>
            </p>
          )}
        </div>
      )}

      {/* EV Panel */}
      {quiz.answered && evInfo && (
        <div className="ev-panel">
          <div className="ev-row ev-row-current">
            <span className="ev-label">この回答のEV:</span>
            <span className={`ev-value ${evInfo.selectedEV !== null && evInfo.selectedEV < 0 ? 'ev-negative' : 'ev-positive'}`}>
              {evInfo.splitUnavailable
                ? `SPLIT不可 (${evInfo.selectedEV !== null ? formatEV(evInfo.selectedEV) : '---'}を計上)`
                : evInfo.selectedEV !== null ? formatEV(evInfo.selectedEV) : '---'}
            </span>
            <span className="ev-separator">|</span>
            <span className="ev-label">最適 ({getActionLabel(evInfo.optimalAction)}):</span>
            <span className="ev-value ev-positive">{formatEV(evInfo.optimalEV)}</span>
            <span className="ev-separator">|</span>
            <span className="ev-label">差:</span>
            <span className={`ev-value ${evInfo.evDiff !== null && evInfo.evDiff < -0.0005 ? 'ev-negative' : 'ev-optimal'}`}>
              {evInfo.evDiff !== null
                ? (Math.abs(evInfo.evDiff) < 0.0005 ? '最適!' : formatEV(evInfo.evDiff))
                : '---'}
            </span>
          </div>

          {/* Bet judgment */}
          <div className="ev-row ev-row-bet">
            <span className={`bet-judgment ${betCorrect ? 'bet-correct' : 'bet-incorrect'}`}>
              ベット: {betCorrect ? '○ 正解' : '✗ 不正解'}
              （配布前カウント {formatCount(quiz.preDealCount)} → {recommendedBet === 'x2' ? 'x2' : 'ノーマル'}推奨）
            </span>
            <span className="ev-separator">|</span>
            <span className="ev-label">
              現在カウント: {formatCount(quiz.currentCount)}
            </span>
          </div>

          {cumulative.count > 0 && (
            <div className="ev-row ev-row-cumulative">
              <span className="ev-label">累積 ({cumulative.count}問):</span>
              <span className="ev-label">あなた</span>
              <span className={`ev-value ${cumulative.totalSelectedEV < 0 ? 'ev-negative' : 'ev-positive'}`}>
                {formatEV(cumulative.totalSelectedEV)}
              </span>
              <span className="ev-separator">|</span>
              <span className="ev-label">最適</span>
              <span className={`ev-value ${cumulative.totalOptimalEV < 0 ? 'ev-negative' : 'ev-positive'}`}>
                {formatEV(cumulative.totalOptimalEV)}
              </span>
              <span className="ev-separator">|</span>
              <span className="ev-label">差</span>
              <span className={`ev-value ${(cumulative.totalSelectedEV - cumulative.totalOptimalEV) < -0.0005 ? 'ev-negative' : 'ev-optimal'}`}>
                {formatEV(cumulative.totalSelectedEV - cumulative.totalOptimalEV)}
              </span>
              <span className="ev-separator">|</span>
              <span className="ev-label">ベット正解率:</span>
              <span className="ev-value ev-positive">
                {betStats.correct}/{betStats.total}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Hand info bar: shows current bet and remaining cards near the action area */}
      <div className="hand-info-bar">
        <span className="hand-info-item">Bet: {quiz.lockedBetLevel === 'x2' ? 'x2' : 'ノーマル'}</span>
        <span className="hand-info-item">残り {quiz.remaining} 枚</span>
      </div>

      {/* Next bet toggle (shown only after answering, above action buttons) */}
      {quiz.answered && (
        <div className="next-bet-section">
          <span className="bet-toggle-label">次のベット:</span>
          <div className="bet-toggle">
            <button
              className={`bet-toggle-btn ${nextBetLevel === 'normal' ? 'bet-toggle-active' : ''}`}
              onClick={() => handleNextBetToggle('normal')}
            >
              ノーマル
            </button>
            <button
              className={`bet-toggle-btn ${nextBetLevel === 'x2' ? 'bet-toggle-active' : ''}`}
              onClick={() => handleNextBetToggle('x2')}
            >
              x2
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="action-buttons">
        {!quiz.answered ? (
          <>
            <button
              className="action-btn btn-hit"
              onClick={() => handleAnswer('HIT')}
            >
              HIT
            </button>
            <button
              className="action-btn btn-stand"
              onClick={() => handleAnswer('STAND')}
            >
              STAND
            </button>
            <button
              className="action-btn btn-double"
              onClick={() => handleAnswer('DOUBLE')}
            >
              DOUBLE
            </button>
            <button
              className="action-btn btn-split"
              onClick={() => handleAnswer('SPLIT')}
            >
              SPLIT
            </button>
          </>
        ) : (
          <>
            <button
              className="action-btn btn-retry"
              onClick={handleRetry}
            >
              Retry
            </button>
            {quiz.isCorrect === false && (
              <button
                className="action-btn btn-show-table"
                onClick={handleToggleTable}
              >
                {showTable ? '表を閉じる' : '表で確認'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Highlighted strategy table for incorrect answers */}
      {quiz.answered && quiz.isCorrect === false && showTable && (() => {
        const lookup = getStrategyLookup(quiz.playerCards, quiz.dealerCard)
        return (
          <div className="quiz-table-container">
            <HighlightedStrategyTable
              handType={lookup.handType}
              highlight={{ rowKey: lookup.rowKey, colIndex: lookup.colIndex }}
            />
          </div>
        )
      })()}
    </div>
  )
}
