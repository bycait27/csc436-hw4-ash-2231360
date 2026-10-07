export interface WorkloadMetrics {
  matchingTickets: number
  openTickets: number
  overdueOpen: number
  knownOpenHours: number
  knownOpenCount: number
  unknownOpenCount: number
}

const REFERENCE_DATE_UTC = Date.UTC(2026, 3, 1)
const DAY_IN_MS = 24 * 60 * 60 * 1000

function parseUtcDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null

  const timestamp = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(timestamp)) return null

  const date = new Date(timestamp)
  return date.toISOString().slice(0, 10) === value ? timestamp : null
}

export function calculateWorkload(
  headers: string[],
  rows: string[][],
): WorkloadMetrics {
  const columnIndex = new Map(headers.map((header, index) => [header, index]))
  const value = (row: string[], column: string) =>
    row[columnIndex.get(column) ?? -1] ?? ''
  const openRows = rows.filter((row) => value(row, 'closed_on') === '')
  const knownOpenCount = openRows.filter(
    (row) => value(row, 'estimated_hours').trim() !== '',
  ).length
  const unknownOpenCount = openRows.length - knownOpenCount
  const knownOpenHours = openRows.reduce((sum, row) => {
    const estimate = value(row, 'estimated_hours')
    if (estimate.trim() === '') return sum

    const hours = Number(estimate)
    return Number.isFinite(hours) ? sum + hours : sum
  }, 0)
  const overdueOpen = openRows.filter((row) => {
    const openedAt = parseUtcDate(value(row, 'opened_on'))
    return (
      openedAt !== null &&
      REFERENCE_DATE_UTC - openedAt >= 14 * DAY_IN_MS
    )
  }).length

  return {
    matchingTickets: rows.length,
    openTickets: openRows.length,
    overdueOpen,
    knownOpenHours,
    knownOpenCount,
    unknownOpenCount,
  }
}
