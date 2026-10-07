export type ZoneFilter = 'all' | 'North' | 'Central' | 'South'
export type StatusFilter = 'all' | 'Open' | 'Closed'
export type SortOrder = 'ticketId' | 'oldest' | 'newest'

export interface RecordFilters {
  search: string
  zone: ZoneFilter
  status: StatusFilter
  sortOrder: SortOrder
}

export function filterRecords(
  headers: string[],
  rows: string[][],
  { search, zone, status, sortOrder }: RecordFilters,
): string[][] {
  const columnIndex = new Map(headers.map((header, index) => [header, index]))
  const value = (row: string[], column: string) =>
    row[columnIndex.get(column) ?? -1] ?? ''
  const normalizedSearch = search.trim().toLocaleLowerCase()

  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const matchesSearch =
        normalizedSearch === '' ||
        value(row, 'ticket_id').toLocaleLowerCase().includes(normalizedSearch) ||
        value(row, 'summary').toLocaleLowerCase().includes(normalizedSearch)
      const matchesZone = zone === 'all' || value(row, 'zone') === zone
      const rowStatus = value(row, 'closed_on') === '' ? 'Open' : 'Closed'
      const matchesStatus = status === 'all' || rowStatus === status

      return matchesSearch && matchesZone && matchesStatus
    })
    .sort((first, second) => {
      if (sortOrder === 'ticketId') {
        return value(first.row, 'ticket_id').localeCompare(
          value(second.row, 'ticket_id'),
          undefined,
          { numeric: true },
        ) || first.index - second.index
      }

      const dateOrder = value(first.row, 'opened_on').localeCompare(
        value(second.row, 'opened_on'),
      )

      return (sortOrder === 'oldest' ? dateOrder : -dateOrder) ||
        first.index - second.index
    })
    .map(({ row }) => row)
}
