import { useState } from 'react'
import './MatchingTickets.css'

interface MatchingTicketsProps {
  headers: string[]
  rows: string[][]
}

const PAGE_SIZE = 50
const DISPLAY_COLUMNS = [
  ['Ticket ID', 'ticket_id'],
  ['Zone', 'zone'],
  ['Category', 'category'],
  ['Priority', 'priority'],
  ['Opened', 'opened_on'],
  ['Closed', 'closed_on'],
  ['Estimate (h)', 'estimated_hours'],
  ['Summary', 'summary'],
] as const

export function MatchingTickets({ headers, rows }: MatchingTicketsProps) {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const currentPage = Math.min(page, Math.max(totalPages - 1, 0))
  const startIndex = currentPage * PAGE_SIZE
  const visibleRows = rows.slice(startIndex, startIndex + PAGE_SIZE)
  const firstRecord = rows.length === 0 ? 0 : startIndex + 1
  const lastRecord = Math.min(startIndex + PAGE_SIZE, rows.length)

  function getValue(row: string[], column: string) {
    const index = headers.indexOf(column)
    return index === -1 ? '' : row[index] ?? ''
  }

  return (
    <section className="matching-tickets" aria-labelledby="matching-tickets-title">
      <div className="matching-tickets__heading">
        <h2 id="matching-tickets-title">Matching tickets</h2>
        <p aria-live="polite">
          {rows.length === 0
            ? 'No matching records'
            : `${firstRecord}–${lastRecord} of ${rows.length} records`}
        </p>
      </div>

      {rows.length > 0 ? (
        <>
          <p className="matching-tickets__description">
            Source values. Unknown estimates stay unknown; closed-ticket hours
            do not enter open-workload totals.
          </p>
          <div
            className="matching-tickets__table-wrap"
            role="region"
            aria-label="Matching tickets table; scroll horizontally to see all columns"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  {DISPLAY_COLUMNS.map(([label]) => (
                    <th key={label} scope="col">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, visibleIndex) => (
                  <tr key={`${getValue(row, 'ticket_id')}-${startIndex + visibleIndex}`}>
                    {DISPLAY_COLUMNS.map(([, column]) => {
                      const value = getValue(row, column)

                      if (column === 'ticket_id') {
                        return <th key={column} scope="row">{value}</th>
                      }
                      if (column === 'closed_on' && value === '') {
                        return <td key={column}><strong>Open</strong></td>
                      }
                      if (column === 'estimated_hours' && value === '') {
                        return <td key={column}>Unknown</td>
                      }
                      return <td key={column}>{value}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="matching-tickets__empty">
          No tickets match these filters. Change a filter or use Reset filters
          to see the dataset again.
        </p>
      )}

      <nav className="matching-tickets__pagination" aria-label="Matching ticket pages">
        <button
          className="matching-tickets__page-button"
          type="button"
          onClick={() => setPage(currentPage - 1)}
          disabled={currentPage === 0}
        >
          Previous
        </button>
        <span aria-live="polite">
          {rows.length === 0
            ? `Page 0 of 0 / ${PAGE_SIZE} per page · 0 records`
            : `Page ${currentPage + 1} of ${totalPages} / ${PAGE_SIZE} per page`}
        </span>
        <button
          className="matching-tickets__page-button"
          type="button"
          onClick={() => setPage(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
        >
          Next
        </button>
      </nav>
    </section>
  )
}

export default MatchingTickets
