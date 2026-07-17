import { Link, useLocation } from 'react-router-dom'

export function Header() {
  const location = useLocation()

  return (
    <header className="header">
      <h1 className="header-title">
        <span className="diamond-icon">{'◆'}</span> Basic Strategy Trainer
      </h1>
      <nav className="header-nav">
        <Link
          to="/"
          className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
        >
          トップ
        </Link>
        <Link
          to="/score/explanation/"
          className={`nav-link ${location.pathname === '/score/explanation/' ? 'active' : ''}`}
        >
          説明
        </Link>
      </nav>
    </header>
  )
}
