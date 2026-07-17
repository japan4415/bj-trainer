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

      <div className="explanation-text" style={{ marginTop: '40px' }}>
        <h2 className="strategy-table-title">Ace-Five カウント</h2>
        <p>
          Ace-Fiveカウントは最もシンプルなカードカウンティング手法です。
          シャッフル直後にカウントを0から開始し、場に見えたカードについて
          <strong>5が出るたびに+1</strong>、<strong>Aが出るたびに-1</strong>します。
          それ以外のカードではカウントは変化しません。
        </p>
        <p>
          カウントが<strong>+2以上</strong>のとき、残りのカードはプレイヤーに有利な構成になっているため、
          ベットを<strong>2倍（x2）</strong>にすることが推奨されます。
          カウントが+1以下のときは通常のベット（ノーマル）で遊びます。
        </p>
        <p>
          本アプリでは6デッキ（312枚）のシューを使用し、
          残り枚数が約1/4（0〜78枚）になった時点でシャッフルを行い、
          カウントがリセットされます。
        </p>
      </div>
    </div>
  )
}
