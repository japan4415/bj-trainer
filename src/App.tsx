import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Header } from './components/Header'
import { QuizPage } from './components/QuizPage'
import { ExplanationPage } from './components/ExplanationPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="vegas-container">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<QuizPage />} />
            <Route path="/score/explanation/" element={<ExplanationPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
