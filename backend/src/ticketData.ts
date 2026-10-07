import { readFile } from 'node:fs/promises'
import { parseCsv } from '../../frontend/src/lib/parseCsv'
import { validateRecords, type RejectedRecord } from '../../frontend/src/lib/validateRecords'

export const TICKET_HEADERS = [
  'ticket_id',
  'zone',
  'category',
  'priority',
  'opened_on',
  'closed_on',
  'estimated_hours',
  'summary',
] as const

export interface Ticket {
  ticket_id: string
  zone: string
  category: string
  priority: string
  opened_on: string
  closed_on: string | null
  estimated_hours: number | null
  summary: string
}

export interface LoadedTicketData {
  tickets: Ticket[]
  rejectedRecords: RejectedRecord[]
  ignoredCount: number
}

export function parseTicketData(csvText: string): LoadedTicketData {
  const parsed = parseCsv(csvText)
  const actualHeaders = new Set(parsed.headers)
  if (
    parsed.headers.length !== TICKET_HEADERS.length ||
    actualHeaders.size !== TICKET_HEADERS.length ||
    TICKET_HEADERS.some((header) => !actualHeaders.has(header))
  ) {
    throw new Error(
      `Ticket CSV must contain exactly these headers: ${TICKET_HEADERS.join(', ')}.`,
    )
  }

  const validation = validateRecords(parsed)
  const columnIndex = new Map(parsed.headers.map((header, index) => [header, index]))
  const indexOf = (header: (typeof TICKET_HEADERS)[number]) => {
    const index = columnIndex.get(header)
    if (index === undefined) {
      throw new Error(`Ticket CSV is missing the "${header}" header.`)
    }
    return index
  }
  const tickets = validation.acceptedRows.map((row) => ({
    ticket_id: row[indexOf('ticket_id')],
    zone: row[indexOf('zone')],
    category: row[indexOf('category')],
    priority: row[indexOf('priority')],
    opened_on: row[indexOf('opened_on')],
    closed_on: row[indexOf('closed_on')] || null,
    estimated_hours:
      row[indexOf('estimated_hours')] === ''
        ? null
        : Number(row[indexOf('estimated_hours')]),
    summary: row[indexOf('summary')],
  }))

  return {
    tickets,
    rejectedRecords: validation.rejectedRecords,
    ignoredCount: validation.ignoredCount,
  }
}

export async function loadTicketData(filePath: string): Promise<LoadedTicketData> {
  const csvText = await readFile(filePath, 'utf8')
  return parseTicketData(csvText)
}