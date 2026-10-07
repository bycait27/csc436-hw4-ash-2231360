import { Router, type Request, type RequestHandler } from 'express'
import { validateRecords } from '../../frontend/src/lib/validateRecords'
import { TICKET_HEADERS, type Ticket } from './ticketData'
import type { TicketStore } from './store'

const VALID_ZONES = new Set(['North', 'Central', 'South'])
const VALID_STATUSES = new Set(['all', 'open', 'closed'])
const VALID_SORTS = new Set(['opened-asc', 'hours-desc'])
const TICKET_ID_PATTERN = /^T-[0-9]{5}$/
const PAGE_SIZE = 50
const REFERENCE_DATE = Date.UTC(2026, 3, 1)
const DAY_IN_MS = 24 * 60 * 60 * 1000

export class HttpError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Array<{ field: string; message: string }>

  constructor(
    status: number,
    code: string,
    message: string,
    details: Array<{ field: string; message: string }> = [],
  ) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.details = details
  }
}

interface Filters {
  search: string
  zone: string
  status: string
}

interface ListFilters extends Filters {
  sort: string
  page: number
}

function queryValue(req: Request, key: string, fallback = ''): string {
  const value: unknown = req.query[key]
  if (value === undefined) return fallback
  if (typeof value !== 'string') {
    throw new HttpError(400, 'invalid_query', `${key} must be a single value.`)
  }
  return value
}

function parseFilters(req: Request): Filters {
  const search = queryValue(req, 'search').trim()
  const zone = queryValue(req, 'zone', 'all')
  const status = queryValue(req, 'status', 'all')

  if (zone !== 'all' && !VALID_ZONES.has(zone)) {
    throw new HttpError(400, 'invalid_query', 'zone must be all, North, Central, or South.')
  }
  if (!VALID_STATUSES.has(status)) {
    throw new HttpError(400, 'invalid_query', 'status must be all, open, or closed.')
  }
  if (req.query.sort !== undefined) {
    const sort = queryValue(req, 'sort')
    if (!VALID_SORTS.has(sort)) {
      throw new HttpError(400, 'invalid_query', 'sort must be opened-asc or hours-desc.')
    }
  }

  return { search, zone, status }
}

function parseListFilters(req: Request): ListFilters {
  const filters = parseFilters(req)
  const sort = queryValue(req, 'sort', 'opened-asc')
  if (!VALID_SORTS.has(sort)) {
    throw new HttpError(400, 'invalid_query', 'sort must be opened-asc or hours-desc.')
  }

  const pageValue = queryValue(req, 'page', '1')
  if (!/^[1-9][0-9]*$/.test(pageValue) || !Number.isSafeInteger(Number(pageValue))) {
    throw new HttpError(400, 'invalid_query', 'page must be a whole number greater than or equal to 1.')
  }

  return { ...filters, sort, page: Number(pageValue) }
}

function matches(ticket: Ticket, filters: Filters): boolean {
  const search = filters.search.toLocaleLowerCase()
  return (
    (filters.zone === 'all' || ticket.zone === filters.zone) &&
    (filters.status === 'all' ||
      (filters.status === 'open' ? ticket.closed_on === null : ticket.closed_on !== null)) &&
    (search === '' ||
      ticket.ticket_id.toLocaleLowerCase().includes(search) ||
      ticket.summary.toLocaleLowerCase().includes(search))
  )
}

function compareTickets(sort: string) {
  return (left: Ticket, right: Ticket) => {
    if (sort === 'hours-desc') {
      if (left.estimated_hours === null && right.estimated_hours !== null) return 1
      if (left.estimated_hours !== null && right.estimated_hours === null) return -1
      if (left.estimated_hours !== right.estimated_hours) {
        return (right.estimated_hours ?? 0) - (left.estimated_hours ?? 0)
      }
    } else {
      const openedOrder = left.opened_on.localeCompare(right.opened_on)
      if (openedOrder !== 0) return openedOrder
    }
    return left.ticket_id.localeCompare(right.ticket_id)
  }
}

function metrics(tickets: Ticket[]) {
  const openTickets = tickets.filter((ticket) => ticket.closed_on === null)
  const overdueOpenCount = openTickets.filter((ticket) => {
    const openedAt = Date.parse(`${ticket.opened_on}T00:00:00Z`)
    return Number.isFinite(openedAt) && REFERENCE_DATE - openedAt >= 14 * DAY_IN_MS
  }).length
  const knownOpen = openTickets.filter((ticket) => ticket.estimated_hours !== null)

  return {
    matchingCount: tickets.length,
    openCount: openTickets.length,
    overdueOpenCount,
    knownOpenHours: knownOpen.reduce(
      (total, ticket) => total + (ticket.estimated_hours ?? 0),
      0,
    ),
    knownOpenCount: knownOpen.length,
    unknownOpenCount: openTickets.length - knownOpen.length,
  }
}

export function summaryHandler(store: TicketStore): RequestHandler {
  return (req, res) => {
    const filters = parseFilters(req)
    const filtered = store.list().filter((ticket) => matches(ticket, filters))
    res.json({
      asOf: '2026-04-01',
      filters,
      metrics: metrics(filtered),
      byZone: ['North', 'Central', 'South'].map((zone) => ({
        zone,
        metrics: metrics(filtered.filter((ticket) => ticket.zone === zone)),
      })),
    })
  }
}
function requestObject(req: Request): Record<string, unknown> {
  const body: unknown = req.body
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'invalid_ticket', 'Send a JSON object.', [
      { field: 'body', message: 'Send a JSON object with Content-Type: application/json.' },
    ])
  }
  return body as Record<string, unknown>
}

function bodyRow(body: Record<string, unknown>): string[] {
  return TICKET_HEADERS.map((field) => {
    const value = body[field]
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value
    if (field === 'estimated_hours' && typeof value === 'number') return String(value)
    return String(value)
  })
}

function validateTicketBody(body: Record<string, unknown>): Ticket {
  const row = bodyRow(body)
  const validation = validateRecords({ headers: [...TICKET_HEADERS], rows: [row] })
  const rejected = validation.rejectedRecords[0]
  if (rejected) {
    throw new HttpError(400, 'invalid_ticket', 'Ticket does not satisfy the data contract.', rejected.issues)
  }
  if (validation.acceptedRows.length === 0) {
    const requiredFields = [
      'ticket_id',
      'zone',
      'category',
      'priority',
      'opened_on',
      'summary',
    ]
    throw new HttpError(400, 'invalid_ticket', 'Ticket does not satisfy the data contract.',
      requiredFields.map((field) => ({ field, message: `${field} is required.` })))
  }
  return ticketFromRow(validation.acceptedRows[0])
}

function ticketFromRow(row: string[]): Ticket {
  const values = new Map(TICKET_HEADERS.map((field, index) => [field, row[index]]))
  return {
    ticket_id: values.get('ticket_id') ?? '',
    zone: values.get('zone') ?? '',
    category: values.get('category') ?? '',
    priority: values.get('priority') ?? '',
    opened_on: values.get('opened_on') ?? '',
    closed_on: values.get('closed_on') || null,
    estimated_hours:
      values.get('estimated_hours') === ''
        ? null
        : Number(values.get('estimated_hours')),
    summary: values.get('summary') ?? '',
  }
}

function routeId(req: Request): string {
  const id = req.params.id
  if (typeof id !== 'string') {
    throw new HttpError(400, 'invalid_ticket_id', 'Ticket ID must be a single value.')
  }
  return id
}

function findTicket(store: TicketStore, id: string): Ticket {
  if (!TICKET_ID_PATTERN.test(id)) {
    throw new HttpError(400, 'invalid_ticket_id', 'Ticket ID must match T- followed by exactly five digits.')
  }
  const ticket = store.get(id)
  if (!ticket) throw new HttpError(404, 'not_found', `No ticket ${id}.`)
  return ticket
}

export function ticketsRouter(
  store: TicketStore,
  allowWrites: boolean,
): Router {
  const router = Router()
  const writable: RequestHandler = (_req, _res, next) => {
    if (!allowWrites) {
      next(new HttpError(403, 'read_only', 'Ticket changes are disabled.'))
      return
    }
    next()
  }

  router.get('/', (req, res) => {
    const filters = parseListFilters(req)
    const filtered = store.list().filter((ticket) => matches(ticket, filters))
    const sorted = [...filtered].sort(compareTickets(filters.sort))
    const offset = (filters.page - 1) * PAGE_SIZE
    res.json({
      items: sorted.slice(offset, offset + PAGE_SIZE),
      page: filters.page,
      pageSize: PAGE_SIZE,
      matchingCount: filtered.length,
      totalPages: Math.ceil(filtered.length / PAGE_SIZE),
    })
  })

  router.get('/summary', summaryHandler(store))

  router.get('/:id', (req, res) => {
    res.json(findTicket(store, routeId(req)))
  })

  router.post('/', writable, (req, res) => {
    const body = requestObject(req)
    const ticket = validateTicketBody(body)
    if (store.get(ticket.ticket_id)) {
      throw new HttpError(409, 'duplicate_ticket_id', `Ticket ${ticket.ticket_id} already exists.`, [
        { field: 'ticket_id', message: 'Ticket ID must be unique.' },
      ])
    }
    store.insert(ticket)
    res.status(201).location(`/api/tickets/${ticket.ticket_id}`).json(ticket)
  })

  router.patch('/:id', writable, (req, res) => {
    const current = findTicket(store, routeId(req))
    const body = requestObject(req)
    const allowedFields = new Set(['closed_on', 'estimated_hours'])
    const unexpectedFields = Object.keys(body).filter((field) => !allowedFields.has(field))
    if (unexpectedFields.length > 0) {
      throw new HttpError(400, 'invalid_ticket', 'PATCH may only set closed_on and/or estimated_hours.',
        unexpectedFields.map((field) => ({ field, message: 'Field cannot be changed with PATCH.' })))
    }
    if (Object.keys(body).length === 0) {
      throw new HttpError(400, 'invalid_ticket', 'PATCH must include closed_on and/or estimated_hours.')
    }

    const ticket = validateTicketBody({ ...current, ...body })
    store.update(current.ticket_id, ticket)
    res.json(ticket)
  })

  router.delete('/:id', writable, (req, res) => {
    const ticket = findTicket(store, routeId(req))
    store.remove(ticket.ticket_id)
    res.status(204).end()
  })

  return router
}