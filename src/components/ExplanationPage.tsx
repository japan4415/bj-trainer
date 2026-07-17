import { useEffect } from 'react'
import { StrategyTables } from './StrategyTable'

export function ExplanationPage() {
  useEffect(() => {
    document.title = 'Basic Strategy Trainer'
  }, [])

  return (
    <div className="explanation-page">
      <div className="explanation-text">
        <p>
          トランプゲームのブラックジャックには、
          ディーラーのカードとプレイヤーのカードの組み合わせに応じた最適戦略があり、
          ベーシックストラテジーと呼ばれています。
          本ツールは、このベーシックストラテジーを練習するためのツールです。
        </p>
        <p>
          ブラックジャックのルールについては{' '}
          <a
            href="https://ja.wikipedia.org/wiki/%E3%83%96%E3%83%A9%E3%83%83%E3%82%AF%E3%82%B8%E3%83%A3%E3%83%83%E3%82%AF"
            target="_blank"
            rel="noopener noreferrer"
            className="wiki-link"
          >
            こちら
          </a>
        </p>
        <p>
          本ツールのベーシックストラテジーは、下記の表に従います。
          例えば、ディーラーのカードがダイヤ2、プレイヤーのカードがクラブ4とハートKの場合、
          DEALER&apos;S HANDが2、YOUR HANDが14のセルを確認し、STANDが最適解になります。
        </p>
      </div>

      <StrategyTables />
    </div>
  )
}
