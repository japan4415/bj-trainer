import { useState, useCallback, useEffect, useRef } from 'react'
import type { Card as CardType, Action } from '../types'
import { PlayingCard, CardBack } from './Card'
import { HighlightedStrategyTable } from './StrategyTable'
import { dealHand } from '../deck'
import { getCorrectAction, getStrategyLookup } from '../strategy'
import { getActionEVs } from '../ev'

interface QuizState {
  dealerCard: CardType
  playerCards: [CardType, CardType]
  answered: boolean
  selectedAction: Action | null
  correctAction: Action
  isCorrect: boolean | null
}

interface CumulativeEV {
  count: number
  totalSelectedEV: number
  totalOptimalEV: number
}

interface EVInfo {
  actionEVs: Record<Action, number | null>
  selectedEV: number | null
  optimalAction: Action
  optimalEV: number
  evDiff: number | null
  splitUnavailable: boolean
}

function createQuizState(): QuizState {
  const { dealerCard, playerCards } = dealHand()
  const correctAction = getCorrectAction(playerCards, dealerCard)
  return {
    dealerCard,
    playerCards,
    answered: false,
    selectedAction: null,
    correctAction,
    isCorrect: null,
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
  const [quiz, setQuiz] = useState<QuizState>(createQuizState)
  const [showTable, setShowTable] = useState(false)
  const [evInfo, setEVInfo] = useState<EVInfo | null>(null)
  const cumulativeRef = useRef<CumulativeEV>({ count: 0, totalSelectedEV: 0, totalOptimalEV: 0 })
  const [cumulative, setCumulative] = useState<CumulativeEV>({ count: 0, totalSelectedEV: 0, totalOptimalEV: 0 })

  useEffect(() => {
    document.title = 'トレーニング'
  }, [])

  const handleAnswer = useCallback((action: Action) => {
    if (quiz.answered) return

    const info = computeEVInfo(quiz.playerCards, quiz.dealerCard, action)
    setEVInfo(info)

    // Update cumulative
    if (info.selectedEV !== null) {
      const newCumulative: CumulativeEV = {
        count: cumulativeRef.current.count + 1,
        totalSelectedEV: cumulativeRef.current.totalSelectedEV + info.selectedEV,
        totalOptimalEV: cumulativeRef.current.totalOptimalEV + info.optimalEV,
      }
      cumulativeRef.current = newCumulative
      setCumulative(newCumulative)
    }

    setQuiz((prev) => ({
      ...prev,
      answered: true,
      selectedAction: action,
      isCorrect: action === prev.correctAction,
    }))
  }, [quiz.playerCards, quiz.dealerCard, quiz.answered])

  const handleRetry = useCallback(() => {
    setQuiz(createQuizState())
    setShowTable(false)
    setEVInfo(null)
  }, [])

  const handleToggleTable = useCallback(() => {
    setShowTable((prev) => !prev)
  }, [])

  return (
    <div className="quiz-page">
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
            </div>
          )}
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
