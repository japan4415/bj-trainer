import type { Action, HandType } from '../types'
import { HARD_TABLE, SOFT_TABLE, PAIR_TABLE, DEALER_COLUMNS } from '../strategy'

function getActionLabel(action: Action): string {
  switch (action) {
    case 'HIT': return 'H'
    case 'STAND': return 'S'
    case 'DOUBLE': return 'DD'
    case 'SPLIT': return 'SP'
  }
}

function getActionClass(action: Action): string {
  switch (action) {
    case 'HIT': return 'cell-hit'
    case 'STAND': return 'cell-stand'
    case 'DOUBLE': return 'cell-double'
    case 'SPLIT': return 'cell-split'
  }
}

export interface HighlightInfo {
  rowKey: number
  colIndex: number
}

interface StrategyTableProps {
  title: string
  table: Record<number, readonly Action[]>
  rowLabels: { key: number; label: string }[]
  highlight?: HighlightInfo
}

function StrategyTableView({ title, table, rowLabels, highlight }: StrategyTableProps) {
  return (
    <div className="strategy-table-wrapper">
      <h3 className="strategy-table-title">{title}</h3>
      <div className="strategy-table-scroll">
        <table className="strategy-table">
          <thead>
            <tr>
              <th className="strategy-header-cell">YOUR HAND</th>
              {DEALER_COLUMNS.map((col, ci) => (
                <th
                  key={col}
                  className={
                    'strategy-header-cell' +
                    (highlight && ci === highlight.colIndex ? ' hl-col' : '')
                  }
                >
                  {col}
                </th>
              ))}
            </tr>
            <tr>
              <th className="strategy-subheader-cell" />
              <th colSpan={10} className="strategy-subheader-cell">
                DEALER&apos;S HAND
              </th>
            </tr>
          </thead>
          <tbody>
            {rowLabels.map(({ key, label }) => {
              const row = table[key]
              if (!row) return null
              const isHighlightedRow = highlight != null && key === highlight.rowKey
              return (
                <tr key={key}>
                  <td
                    className={
                      'strategy-row-label' +
                      (isHighlightedRow ? ' hl-row' : '')
                    }
                  >
                    {label}
                  </td>
                  {row.map((action, i) => {
                    const isIntersection = isHighlightedRow && highlight != null && i === highlight.colIndex
                    const isRowOrCol = isHighlightedRow || (highlight != null && i === highlight.colIndex)
                    let cls = `strategy-cell ${getActionClass(action)}`
                    if (highlight != null) {
                      if (isIntersection) {
                        cls += ' hl-intersection'
                      } else if (!isRowOrCol) {
                        cls += ' hl-dimmed'
                      }
                    }
                    return (
                      <td key={i} className={cls}>
                        {getActionLabel(action)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const HARD_ROWS = Array.from({ length: 17 }, (_, i) => ({
  key: i + 4,
  label: String(i + 4),
}))

const SOFT_ROWS = Array.from({ length: 9 }, (_, i) => ({
  key: i + 2,
  label: `A-${i + 2 >= 10 ? '10' : String(i + 2)}`,
}))

const PAIR_ROWS = [
  { key: 2, label: '2-2' },
  { key: 3, label: '3-3' },
  { key: 4, label: '4-4' },
  { key: 5, label: '5-5' },
  { key: 6, label: '6-6' },
  { key: 7, label: '7-7' },
  { key: 8, label: '8-8' },
  { key: 9, label: '9-9' },
  { key: 10, label: '10-10' },
  { key: 11, label: 'A-A' },
]

export function StrategyTables() {
  return (
    <div className="strategy-tables">
      <StrategyTableView title="Hard Totals" table={HARD_TABLE} rowLabels={HARD_ROWS} />
      <StrategyTableView title="Soft Totals" table={SOFT_TABLE} rowLabels={SOFT_ROWS} />
      <StrategyTableView title="Pairs" table={PAIR_TABLE} rowLabels={PAIR_ROWS} />
    </div>
  )
}

interface HighlightedStrategyTableProps {
  handType: HandType
  highlight: HighlightInfo
}

export function HighlightedStrategyTable({ handType, highlight }: HighlightedStrategyTableProps) {
  let title: string
  let table: Record<number, readonly Action[]>
  let rowLabels: { key: number; label: string }[]

  switch (handType) {
    case 'HARD':
      title = 'Hard Totals'
      table = HARD_TABLE
      rowLabels = HARD_ROWS
      break
    case 'SOFT':
      title = 'Soft Totals'
      table = SOFT_TABLE
      rowLabels = SOFT_ROWS
      break
    case 'PAIR':
      title = 'Pairs'
      table = PAIR_TABLE
      rowLabels = PAIR_ROWS
      break
  }

  return (
    <div className="strategy-tables">
      <StrategyTableView
        title={title}
        table={table}
        rowLabels={rowLabels}
        highlight={highlight}
      />
    </div>
  )
}
