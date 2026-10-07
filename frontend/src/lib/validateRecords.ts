import type { ParsedCsv } from './parseCsv'

export interface ValidationIssue {
  field: string
  message: string
}

export interface RecordValidationResult {
  acceptedRows: string[][]
  rejectedRecords: RejectedRecord[]
  ignoredCount: number
}

export interface RejectedRecord {
  recordNumber: number
  ticketId: string
  reason: string
  issues: ValidationIssue[]
}

const MIN_OPENED_DATE = '2026-01-01'
const MAX_DATE = '2026-04-01'
const TICKET_ID_PATTERN = /^T-[0-9]{5}$/
const ESTIMATE_PATTERN = /^[0-9]+(\.[0-9]{1,2})?$/
const VALID_ZONES = new Set(['North', 'South', 'Central'])
const VALID_CATEGORIES = new Set(['Access', 'Comfort', 'Technology'])
const VALID_PRIORITIES = new Set(['Low', 'Normal', 'High'])

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isEmptyRecord(row: string[]): boolean {
  return row.every((value) => value.trim() === '')
}

export function validateRecords(
  { headers, rows }: ParsedCsv,
): RecordValidationResult {
  const columnIndex = new Map(headers.map((header, index) => [header, index]))
  const indexOf = (column: string) => columnIndex.get(column) ?? -1
  const acceptedRows: string[][] = []
  const rejectedRecords: RejectedRecord[] = []
  const acceptedTicketIds = new Set<string>()
  let ignoredCount = 0
  let processedRecordNumber = 0

  for (const row of rows) {
    if (isEmptyRecord(row)) {
      ignoredCount += 1
      continue
    }

    processedRecordNumber += 1

    if (row.length !== headers.length) {
      const message = `Expected ${headers.length} columns, but found ${row.length}.`
      rejectedRecords.push({
        recordNumber: processedRecordNumber,
        ticketId: row[indexOf('ticket_id')]?.trim() ?? '',
        reason: message,
        issues: [{ field: 'record', message }],
      })
      continue
    }

    const normalizedRow = row.map((field) => field.trim())
    const value = (column: string) => normalizedRow[indexOf(column)] ?? ''
    const ticketId = value('ticket_id')
    const openedOn = value('opened_on')
    const closedOn = value('closed_on')
    const estimate = value('estimated_hours')
    const summary = value('summary')
    const openedDateIsValid =
      isValidDate(openedOn) &&
      openedOn >= MIN_OPENED_DATE &&
      openedOn <= MAX_DATE
    const issues: ValidationIssue[] = []
    const reject = (field: string, message: string) => issues.push({ field, message })

    if (!TICKET_ID_PATTERN.test(ticketId)) {
      reject('ticket_id', 'Ticket ID must match T- followed by exactly five digits.')
    }
    if (!VALID_ZONES.has(value('zone'))) {
      reject('zone', 'Zone must be North, South, or Central with exact casing.')
    }
    if (!VALID_CATEGORIES.has(value('category'))) {
      reject('category', 'Category must be Access, Comfort, or Technology.')
    }
    if (!VALID_PRIORITIES.has(value('priority'))) {
      reject('priority', 'Priority must be Low, Normal, or High.')
    }
    if (!openedDateIsValid) {
      reject('opened_on', 'Opened date must be a valid YYYY-MM-DD date from 2026-01-01 through 2026-04-01.')
    }
    if (
      closedOn !== '' &&
      (!isValidDate(closedOn) ||
        !openedDateIsValid ||
        closedOn < openedOn ||
        closedOn > MAX_DATE)
    ) {
      reject('closed_on', 'Closed date must be empty or a valid date from the opened date through 2026-04-01.')
    }
    if (
      estimate !== '' &&
      (!ESTIMATE_PATTERN.test(estimate) || Number(estimate) > 80)
    ) {
      reject('estimated_hours', 'Estimated hours must be empty or a decimal from 0 to 80 with at most two decimal places.')
    }
    if (summary.trim() === '') {
      reject('summary', 'Summary must not be empty.')
    } else if (summary.trim().length > 240) {
      reject('summary', 'Summary must be no more than 240 characters after trimming.')
    }
    if (TICKET_ID_PATTERN.test(ticketId) && acceptedTicketIds.has(ticketId)) {
      reject('ticket_id', 'Ticket ID duplicates an already accepted record.')
    }

    if (issues.length > 0) {
      rejectedRecords.push({
        recordNumber: processedRecordNumber,
        ticketId: ticketId.trim(),
        reason: issues.map(({ message }) => message).join(' '),
        issues,
      })
      continue
    }

    acceptedTicketIds.add(ticketId)
    acceptedRows.push(normalizedRow)
  }

  return { acceptedRows, rejectedRecords, ignoredCount }
}