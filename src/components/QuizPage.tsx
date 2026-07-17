import { useState, useCallback, useEffect } from 'react'
import type { Card as CardType, Action } from '../types'
import { PlayingCard, CardBack } from './Card'
import { dealHand } from '../deck'
import { getCorrectAction } from '../strategy'

interface QuizState {
  dealerCard: CardType
  playerCards: [CardType, CardType]
  answered: boolean
  selectedAction: Action | null
  correctAction: Action
  isCorrect: boolean | null
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

export function QuizPage() {
  const [quiz, setQuiz] = useState<QuizState>(createQuizState)

  useEffect(() => {
    document.title = 'トレーニング'
  }, [])

  const handleAnswer = useCallback((action: Action) => {
    setQuiz((prev) => ({
      ...prev,
      answered: true,
      selectedAction: action,
      isCorrect: action === prev.correctAction,
    }))
  }, [])

  const handleRetry = useCallback(() => {
    setQuiz(createQuizState())
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
          <button
            className="action-btn btn-retry"
            onClick={handleRetry}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
