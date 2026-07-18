import { useState, useCallback, useEffect, useRef } from 'react'
import type { Card as CardType, Action } from '../types'
import { PlayingCard, CardBack } from './Card'
import { HighlightedStrategyTable } from './StrategyTable'
import { getStrategyLookup } from '../strategy'
import { getActionEVsWithCount } from '../ev'
import { createShoe, getRecommendedBet } from '../shoe'
import type { Shoe, BetLevel } from '../shoe'
import {
  dealRound,
  applyFirstAction,
  applyContinueAction,
  resolveRound,
  reshuffleSafetyMargin,
  computeHandValue,
} from '../round'
import type { RoundState, PlayerHand, RoundResult, AiSeat, ContinueFeedback } from '../round'

// ============================================
// Persisted settings
// ============================================

const BET_STORAGE_KEY = 'bj-trainer-bet-level'
const SEATS_STORAGE_KEY = 'bj-trainer-seats'

function loadBetLevel(): BetLevel {
  try {
    const stored = localStorage.getItem(BET_STORAGE_KEY)
    if (stored === 'normal' || stored === 'x2') return stored
  } catch { /* noop */ }
  return 'normal'
}

function saveBetLevel(level: BetLevel): void {
  try { localStorage.setItem(BET_STORAGE_KEY, level) } catch { /* noop */ }
}

function loadSeatCount(): number {
  try {
    const stored = localStorage.getItem(SEATS_STORAGE_KEY)
    if (stored !== null) {
      const n = parseInt(stored, 10)
      if (n >= 0 && n <= 5) return n
    }
  } catch { /* noop */ }
  return 0
}

function saveSeatCount(n: number): void {
  try { localStorage.setItem(SEATS_STORAGE_KEY, String(n)) } catch { /* noop */ }
}

// ============================================
// Types
// ============================================

type GamePhase =
  | 'FIRST_ACTION'    // Quiz: 4 buttons
  | 'CONTINUE'        // User playing out hand: HIT/STAND
  | 'RESOLVED'        // Round over, show results

interface GameState {
  round: RoundState
  phase: GamePhase
  // Snapshot at deal time
  preDealCount: number
  evCount: number     // count for EV calculation (after initial visible cards)
  evRemaining: number // remaining for EV calculation
  shuffled: boolean
  remaining: number
  lockedBetLevel: BetLevel
  // First action quiz
  firstActionCorrect: Action
  selectedFirstAction: Action | null
  isFirstCorrect: boolean | null
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

// ============================================
// Helpers
// ============================================

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
  currentCount: number,
  remaining: number,
): EVInfo {
  const actionEVs = getActionEVsWithCount(playerCards, dealerCard, currentCount, remaining)

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

  let selectedEV: number | null
  if (splitUnavailable) {
    let minEV = Infinity
    for (const ev of Object.values(actionEVs)) {
      if (ev !== null && ev < minEV) minEV = ev
    }
    selectedEV = minEV === Infinity ? null : minEV
  } else {
    selectedEV = selectedEVRaw
  }

  const evDiff = selectedEV !== null ? selectedEV - optimalEV : null
  return { actionEVs, selectedEV, optimalAction, optimalEV, evDiff, splitUnavailable }
}

function handTotalDisplay(hand: PlayerHand): string {
  if (hand.busted) return `${hand.total} BUST`
  return String(hand.total)
}

function resultLabel(r: RoundResult): string {
  switch (r) {
    case 'WIN': return 'WIN'
    case 'LOSE': return 'LOSE'
    case 'PUSH': return 'PUSH'
  }
}

function resultClass(r: RoundResult): string {
  switch (r) {
    case 'WIN': return 'result-win'
    case 'LOSE': return 'result-lose'
    case 'PUSH': return 'result-push'
  }
}

// ============================================
// Component
// ============================================

export function QuizPage() {
  const shoeRef = useRef<Shoe | null>(null)
  const initialGameRef = useRef<GameState | null>(null)

  if (shoeRef.current === null) {
    const shoe = createShoe()
    shoeRef.current = shoe
    const betLevel = loadBetLevel()
    const seatCount = loadSeatCount()
    const preDealCount = shoe.getCount()
    const shuffled = shoe.checkAndReshuffle(reshuffleSafetyMargin(seatCount))
    const drawCard = () => shoe.drawOne()
    const { state: roundState, faceUpCards } = dealRound(drawCard, seatCount)
    for (const c of faceUpCards) shoe.countCard(c)
    const evCount = shoe.getCount()
    const evRemaining = shoe.getRemaining()

    initialGameRef.current = {
      round: roundState,
      phase: 'FIRST_ACTION',
      preDealCount,
      evCount,
      evRemaining,
      shuffled,
      remaining: shoe.getRemaining(),
      lockedBetLevel: betLevel,
      firstActionCorrect: roundState.firstActionCorrectAction,
      selectedFirstAction: null,
      isFirstCorrect: null,
    }
  }

  const [game, setGame] = useState<GameState>(() => initialGameRef.current!)
  const [showTable, setShowTable] = useState(false)
  const [evInfo, setEVInfo] = useState<EVInfo | null>(null)
  const [nextBetLevel, setNextBetLevel] = useState<BetLevel>(loadBetLevel)
  const [nextSeatCount, setNextSeatCount] = useState<number>(loadSeatCount)
  const cumulativeRef = useRef<CumulativeEV>({ count: 0, totalSelectedEV: 0, totalOptimalEV: 0 })
  const [cumulative, setCumulative] = useState<CumulativeEV>({ count: 0, totalSelectedEV: 0, totalOptimalEV: 0 })
  const betStatsRef = useRef<BetStats>({ total: 0, correct: 0 })
  const [betStats, setBetStats] = useState<BetStats>({ total: 0, correct: 0 })

  useEffect(() => { document.title = 'トレーニング' }, [])

  // ---- First action handler (quiz) ----
  const handleFirstAction = useCallback((action: Action) => {
    if (game.phase !== 'FIRST_ACTION') return
    const shoe = shoeRef.current!

    // Compute EV
    const userCards = game.round.userHands[0]!.cards as [CardType, CardType]
    const info = computeEVInfo(userCards, game.round.dealerUpCard, action, game.evCount, game.evRemaining)
    setEVInfo(info)

    // Update cumulative
    const betMultiplier = game.lockedBetLevel === 'x2' ? 2 : 1
    const newCum: CumulativeEV = {
      count: cumulativeRef.current.count + 1,
      totalSelectedEV: cumulativeRef.current.totalSelectedEV + (info.selectedEV !== null ? info.selectedEV * betMultiplier : 0),
      totalOptimalEV: cumulativeRef.current.totalOptimalEV + info.optimalEV * betMultiplier,
    }
    cumulativeRef.current = newCum
    setCumulative(newCum)

    // Bet stats
    const recommendedBet = getRecommendedBet(game.preDealCount)
    const betCorrect = game.lockedBetLevel === recommendedBet
    const newBet: BetStats = {
      total: betStatsRef.current.total + 1,
      correct: betStatsRef.current.correct + (betCorrect ? 1 : 0),
    }
    betStatsRef.current = newBet
    setBetStats(newBet)

    // Apply action
    const drawCard = () => shoe.drawOne()
    const result = applyFirstAction(game.round, action, drawCard)
    for (const c of result.drawnCards) shoe.countCard(c)

    const isCorrect = action === game.firstActionCorrect
    let nextPhase: GamePhase
    if (result.state.phase === 'ROUND_OVER') {
      // Resolve immediately
      const resolved = resolveRound(result.state, drawCard)
      for (const c of resolved.drawnCards) shoe.countCard(c)
      nextPhase = 'RESOLVED'
      setGame(prev => ({
        ...prev,
        round: resolved.state,
        phase: nextPhase,
        remaining: shoe.getRemaining(),
        selectedFirstAction: action,
        isFirstCorrect: isCorrect,
      }))
    } else {
      nextPhase = 'CONTINUE'
      setGame(prev => ({
        ...prev,
        round: result.state,
        phase: nextPhase,
        remaining: shoe.getRemaining(),
        selectedFirstAction: action,
        isFirstCorrect: isCorrect,
      }))
    }
  }, [game.phase, game.round, game.evCount, game.evRemaining, game.lockedBetLevel, game.preDealCount, game.firstActionCorrect])

  // ---- Continue action handler ----
  const handleContinueAction = useCallback((action: 'HIT' | 'STAND') => {
    if (game.phase !== 'CONTINUE') return
    const shoe = shoeRef.current!
    const drawCard = () => shoe.drawOne()

    const result = applyContinueAction(game.round, action, drawCard)
    for (const c of result.drawnCards) shoe.countCard(c)

    if (result.state.phase === 'ROUND_OVER') {
      const resolved = resolveRound(result.state, drawCard)
      for (const c of resolved.drawnCards) shoe.countCard(c)
      setGame(prev => ({
        ...prev,
        round: resolved.state,
        phase: 'RESOLVED',
        remaining: shoe.getRemaining(),
      }))
    } else {
      setGame(prev => ({
        ...prev,
        round: result.state,
        remaining: shoe.getRemaining(),
      }))
    }
  }, [game.phase, game.round])

  // ---- Retry handler ----
  const handleRetry = useCallback(() => {
    const shoe = shoeRef.current!
    const seatCount = nextSeatCount
    const preDealCount = shoe.getCount()
    const shuffled = shoe.checkAndReshuffle(reshuffleSafetyMargin(seatCount))
    const drawCard = () => shoe.drawOne()
    const { state: roundState, faceUpCards } = dealRound(drawCard, seatCount)
    for (const c of faceUpCards) shoe.countCard(c)
    const evCount = shoe.getCount()
    const evRemaining = shoe.getRemaining()

    setGame({
      round: roundState,
      phase: 'FIRST_ACTION',
      preDealCount,
      evCount,
      evRemaining,
      shuffled,
      remaining: shoe.getRemaining(),
      lockedBetLevel: nextBetLevel,
      firstActionCorrect: roundState.firstActionCorrectAction,
      selectedFirstAction: null,
      isFirstCorrect: null,
    })
    setShowTable(false)
    setEVInfo(null)
  }, [nextBetLevel, nextSeatCount])

  const handleNextBetToggle = useCallback((level: BetLevel) => {
    setNextBetLevel(level)
    saveBetLevel(level)
  }, [])

  const handleNextSeatCount = useCallback((n: number) => {
    setNextSeatCount(n)
    saveSeatCount(n)
  }, [])

  const handleToggleTable = useCallback(() => {
    setShowTable(prev => !prev)
  }, [])

  // ---- Derived values ----
  const recommendedBet = getRecommendedBet(game.preDealCount)
  const betCorrect = game.lockedBetLevel === recommendedBet
  const activeHand = game.round.userHands[game.round.activeUserHandIndex]
  const isSplit = game.round.userHands.length > 1
  const isResolved = game.phase === 'RESOLVED'

  // Dealer display
  const dealerCards: (CardType | 'back')[] = [game.round.dealerUpCard]
  if (isResolved) {
    dealerCards.push(game.round.dealerHoleCard)
    dealerCards.push(...game.round.dealerDrawn)
  } else {
    dealerCards.push('back')
  }

  const dealerHv = isResolved
    ? computeHandValue([game.round.dealerUpCard, game.round.dealerHoleCard, ...game.round.dealerDrawn])
    : null

  return (
    <div className="quiz-page">
      {/* Shuffle notification */}
      {game.shuffled && (
        <div className="shuffle-notification">
          シャッフルしました（カウントリセット）
        </div>
      )}

      {/* Dealer section */}
      <div className="hand-section">
        <h2 className="hand-label">
          Dealer
          {isResolved && dealerHv && (
            <span className="hand-total">
              {' '}({game.round.dealerBusted ? `${dealerHv.total} BUST` : dealerHv.total})
            </span>
          )}
        </h2>
        <div className="card-row">
          {dealerCards.map((c, i) =>
            c === 'back'
              ? <CardBack key={`dealer-back-${i}`} />
              : <PlayingCard key={`dealer-${i}`} card={c} />
          )}
        </div>
      </div>

      {/* AI seats */}
      {game.round.aiSeats.map((seat: AiSeat, seatIdx: number) => (
        <div key={`ai-${seatIdx}`} className="hand-section ai-seat-section">
          <h2 className="hand-label ai-seat-label">
            席{seatIdx + 2}
            {isResolved && seat.hands.map((h: PlayerHand, hi: number) => (
              <span key={hi} className="hand-total"> ({handTotalDisplay(h)})</span>
            ))}
          </h2>
          {seat.hands.map((h: PlayerHand, hi: number) => (
            <div key={hi} className="card-row card-row-small">
              {h.cards.map((c: CardType, ci: number) => (
                <PlayingCard key={`ai-${seatIdx}-${hi}-${ci}`} card={c} />
              ))}
            </div>
          ))}
        </div>
      ))}

      {/* Player section */}
      {game.round.userHands.map((hand: PlayerHand, idx: number) => (
        <div key={`user-${idx}`} className={`hand-section ${isSplit ? 'split-hand-section' : ''} ${game.phase === 'CONTINUE' && idx === game.round.activeUserHandIndex ? 'active-hand' : ''}`}>
          <h2 className="hand-label">
            {isSplit ? `You (Hand ${idx + 1})` : 'You'}
            {(isResolved || hand.done) && (
              <span className="hand-total"> ({handTotalDisplay(hand)})</span>
            )}
            {isResolved && game.round.userResults[idx] !== undefined && (
              <span className={`round-result ${resultClass(game.round.userResults[idx]!)}`}>
                {' '}{resultLabel(game.round.userResults[idx]!)}
              </span>
            )}
          </h2>
          <div className="card-row">
            {hand.cards.map((c: CardType, ci: number) => (
              <PlayingCard key={`user-${idx}-${ci}`} card={c} />
            ))}
            {hand.doubled && <span className="doubled-badge">x2</span>}
          </div>
        </div>
      ))}

      {/* Continue feedback (2nd action onward) */}
      {game.round.continueFeedback.length > 0 && (
        <div className="continue-feedback">
          {game.round.continueFeedback.map((fb: ContinueFeedback, i: number) => (
            <span key={i} className={`feedback-item ${fb.action === fb.correctAction ? 'feedback-correct' : 'feedback-incorrect'}`}>
              {fb.action === fb.correctAction ? '✓' : '✗'}{fb.action}
              {fb.action !== fb.correctAction && `(${fb.correctAction})`}
            </span>
          ))}
        </div>
      )}

      {/* First action result */}
      {game.selectedFirstAction !== null && (
        <div className="result-area">
          {game.isFirstCorrect ? (
            <p className="result-text"><strong>Correct!</strong></p>
          ) : (
            <p className="result-text">
              <strong>Incorrect. {getActionLabel(game.firstActionCorrect)} is better.</strong>
            </p>
          )}
        </div>
      )}

      {/* EV Panel */}
      {game.selectedFirstAction !== null && evInfo && (
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

          <div className="ev-row ev-row-bet">
            <span className={`bet-judgment ${betCorrect ? 'bet-correct' : 'bet-incorrect'}`}>
              ベット: {betCorrect ? '○ 正解' : '✗ 不正解'}
              （配布前カウント {formatCount(game.preDealCount)} → {recommendedBet === 'x2' ? 'x2' : 'ノーマル'}推奨）
            </span>
            <span className="ev-separator">|</span>
            <span className="ev-label">
              現在カウント: {formatCount(game.evCount)}
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
          <div className="ev-note">
            EVはA-5補正済み（カウント {formatCount(game.evCount)} / 残り {game.evRemaining}枚）
          </div>
        </div>
      )}

      {/* Hand info bar */}
      <div className="hand-info-bar">
        <span className="hand-info-item">Bet: {game.lockedBetLevel === 'x2' ? 'x2' : 'ノーマル'}</span>
        <span className="hand-info-item">残り {game.remaining} 枚</span>
      </div>

      {/* Next settings (shown only when resolved) */}
      {isResolved && (
        <div className="next-settings-section">
          <div className="next-bet-section">
            <span className="bet-toggle-label">次のベット:</span>
            <div className="bet-toggle">
              <button
                className={`bet-toggle-btn ${nextBetLevel === 'normal' ? 'bet-toggle-active' : ''}`}
                onClick={() => handleNextBetToggle('normal')}
              >ノーマル</button>
              <button
                className={`bet-toggle-btn ${nextBetLevel === 'x2' ? 'bet-toggle-active' : ''}`}
                onClick={() => handleNextBetToggle('x2')}
              >x2</button>
            </div>
          </div>
          <div className="next-seats-section">
            <span className="bet-toggle-label">他の席:</span>
            <div className="seats-toggle">
              {[0, 1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  className={`seats-toggle-btn ${nextSeatCount === n ? 'seats-toggle-active' : ''}`}
                  onClick={() => handleNextSeatCount(n)}
                >{n}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="action-buttons">
        {game.phase === 'FIRST_ACTION' && (
          <>
            <button className="action-btn btn-hit" onClick={() => handleFirstAction('HIT')}>HIT</button>
            <button className="action-btn btn-stand" onClick={() => handleFirstAction('STAND')}>STAND</button>
            <button className="action-btn btn-double" onClick={() => handleFirstAction('DOUBLE')}>DOUBLE</button>
            <button className="action-btn btn-split" onClick={() => handleFirstAction('SPLIT')}>SPLIT</button>
          </>
        )}
        {game.phase === 'CONTINUE' && activeHand && !activeHand.done && (
          <>
            <button className="action-btn btn-hit" onClick={() => handleContinueAction('HIT')}>HIT</button>
            <button className="action-btn btn-stand" onClick={() => handleContinueAction('STAND')}>STAND</button>
          </>
        )}
        {isResolved && (
          <>
            <button className="action-btn btn-retry" onClick={handleRetry}>Retry</button>
            {game.isFirstCorrect === false && (
              <button className="action-btn btn-show-table" onClick={handleToggleTable}>
                {showTable ? '表を閉じる' : '表で確認'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Highlighted strategy table */}
      {isResolved && game.isFirstCorrect === false && showTable && (() => {
        const userCards = game.round.userHands[0]!.cards
        if (userCards.length >= 2) {
          const lookup = getStrategyLookup(
            [userCards[0]!, userCards[1]!] as [CardType, CardType],
            game.round.dealerUpCard,
          )
          return (
            <div className="quiz-table-container">
              <HighlightedStrategyTable
                handType={lookup.handType}
                highlight={{ rowKey: lookup.rowKey, colIndex: lookup.colIndex }}
              />
            </div>
          )
        }
        return null
      })()}
    </div>
  )
}
