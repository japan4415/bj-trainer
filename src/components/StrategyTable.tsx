import type { Action } from '../types'
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

interface StrategyTableProps {
  title: string
  table: Record<number, readonly Action[]>
  rowLabels: { key: number; label: string }[]
}

function StrategyTableView({ title, table, rowLabels }: StrategyTableProps) {
  return (
    <div className="strategy-table-wrapper">
      <h3 className="strategy-table-title">{title}</h3>
      <div className="strategy-table-scroll">
        <table className="strategy-table">
          <thead>
            <tr>
              <th className="strategy-header-cell">YOUR HAND</th>
              {DEALER_COLUMNS.map((col) => (
                <th key={col} className="strategy-header-cell">{col}</th>
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
              return (
                <tr key={key}>
                  <td className="strategy-row-label">{label}</td>
                  {row.map((action, i) => (
                    <td key={i} className={`strategy-cell ${getActionClass(action)}`}>
                      {getActionLabel(action)}
                    </td>
                  ))}
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
