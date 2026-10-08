import { api, ApiError } from './client'

export type Zone = 'North' | 'Central' | 'South'
export type ZoneFilter = 'all' | Zone
export type TicketStatus = 'all' | 'open' | 'closed'
export type TicketSort = 'opened-asc' | 'hours-desc'

export interface Ticket {
  ticket_id: string
  zone: Zone
  category: 'Access' | 'Comfort' | 'Technology'
  priority: 'Low' | 'Normal' | 'High'
  opened_on: string
  closed_on: string | null
  estimated_hours: number | null
  summary: string
}

export interface TicketMetrics {
  matchingCount: number
  openCount: number
  overdueOpenCount: number
  knownOpenHours: number
  knownOpenCount: number
  unknownOpenCount: number
}

export interface TicketFilters {
  search?: string
  zone?: ZoneFilter
  status?: TicketStatus
}

export interface ListQuery extends TicketFilters {
  sort?: TicketSort
  page?: number
}

export interface TicketPage {
  items: Ticket[]
  page: number
  pageSize: number
  matchingCount: number
  totalPages: number
}

export interface TicketSummary {
  asOf: string
  filters: { search: string; zone: ZoneFilter; status: TicketStatus }
  metrics: TicketMetrics
  byZone: Array<{ zone: Zone; metrics: TicketMetrics }>
}

export type NewTicket = Omit<Ticket, 'closed_on' | 'estimated_hours'> & {
  closed_on: string | null
  estimated_hours: number | null
}
export type TicketUpdate = Partial<Pick<Ticket, 'closed_on' | 'estimated_hours'>>

const ZONES: Zone[] = ['North', 'Central', 'South']
const METRIC_KEYS: (keyof TicketMetrics)[] = [
  'matchingCount',
  'openCount',
  'overdueOpenCount',
  'knownOpenHours',
  'knownOpenCount',
  'unknownOpenCount',
]

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidResponse(message: string, status: number, requestId?: string): never {
  throw new ApiError('http', message, status, 'invalid_response', [], requestId)
}

function isZone(value: unknown): value is Zone {
  return typeof value === 'string' && ZONES.some((zone) => zone === value)
}

function isCategory(value: unknown): value is Ticket['category'] {
  return value === 'Access' || value === 'Comfort' || value === 'Technology'
}

function isPriority(value: unknown): value is Ticket['priority'] {
  return value === 'Low' || value === 'Normal' || value === 'High'
}

function parseTicket(value: unknown, status: number, requestId?: string): Ticket {
  if (
    !isObject(value) ||
    typeof value.ticket_id !== 'string' ||
    !isZone(value.zone) ||
    !isCategory(value.category) ||
    !isPriority(value.priority) ||
    typeof value.opened_on !== 'string' ||
    !(typeof value.closed_on === 'string' || value.closed_on === null) ||
    !(
      value.estimated_hours === null ||
      (typeof value.estimated_hours === 'number' && Number.isFinite(value.estimated_hours))
    ) ||
    typeof value.summary !== 'string'
  ) {
    invalidResponse('The API returned an invalid ticket.', status, requestId)
  }
  return {
    ticket_id: value.ticket_id,
    zone: value.zone,
    category: value.category,
    priority: value.priority,
    opened_on: value.opened_on,
    closed_on: value.closed_on,
    estimated_hours: value.estimated_hours,
    summary: value.summary,
  }
}

function isTicketMetrics(value: unknown): value is TicketMetrics {
  return isObject(value) &&
    METRIC_KEYS.every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]))
}

function parseMetrics(value: unknown, status: number, requestId?: string): TicketMetrics {
  if (!isTicketMetrics(value)) {
    invalidResponse('The API returned invalid workload metrics.', status, requestId)
  }
  return value
}

function isZoneFilter(value: unknown): value is ZoneFilter {
  return value === 'all' || isZone(value)
}

function isTicketStatus(value: unknown): value is TicketStatus {
  return value === 'all' || value === 'open' || value === 'closed'
}

function requestId(response: { headers: Record<string, unknown> }): string | undefined {
  const value = response.headers['x-request-id']
  return typeof value === 'string' ? value : undefined
}

export async function listTickets(
  query: ListQuery = {},
  signal?: AbortSignal,
): Promise<TicketPage> {
  const response = await api.get<unknown>('/tickets', { params: query, signal })
  const data = response.data
  if (
    !isObject(data) ||
    !Array.isArray(data.items) ||
    typeof data.page !== 'number' ||
    typeof data.pageSize !== 'number' ||
    typeof data.matchingCount !== 'number' ||
    typeof data.totalPages !== 'number'
  ) {
    invalidResponse('The API returned an invalid ticket list.', response.status, requestId(response))
  }
  return {
    items: data.items.map((ticket) => parseTicket(ticket, response.status, requestId(response))),
    page: data.page,
    pageSize: data.pageSize,
    matchingCount: data.matchingCount,
    totalPages: data.totalPages,
  }
}

export async function getSummary(
  filters: TicketFilters = {},
  signal?: AbortSignal,
): Promise<TicketSummary> {
  const response = await api.get<unknown>('/summary', { params: filters, signal })
  const data = response.data
  const expectedZones = ['North', 'Central', 'South']
  if (
    !isObject(data) ||
    typeof data.asOf !== 'string' ||
    !isObject(data.filters) ||
    typeof data.filters.search !== 'string' ||
    !isZoneFilter(data.filters.zone) ||
    !isTicketStatus(data.filters.status) ||
    !Array.isArray(data.byZone) ||
    data.byZone.length !== expectedZones.length ||
    data.byZone.some((entry, index) =>
      !isObject(entry) ||
      entry.zone !== expectedZones[index] ||
      !isZone(entry.zone),
    )
  ) {
    invalidResponse('The API returned an invalid summary or zone breakdown.', response.status, requestId(response))
  }
  const byZone = data.byZone.map((entry) => {
    if (!isObject(entry) || !isZone(entry.zone)) {
      invalidResponse('The API returned an invalid zone summary.', response.status, requestId(response))
    }
    return {
      zone: entry.zone,
      metrics: parseMetrics(entry.metrics, response.status, requestId(response)),
    }
  })
  return {
    asOf: data.asOf,
    filters: {
      search: data.filters.search,
      zone: data.filters.zone,
      status: data.filters.status,
    },
    metrics: parseMetrics(data.metrics, response.status, requestId(response)),
    byZone,
  }
}

export async function getTicket(id: string): Promise<Ticket> {
  const response = await api.get<unknown>(`/tickets/${encodeURIComponent(id)}`)
  return parseTicket(response.data, response.status, requestId(response))
}

export async function createTicket(input: NewTicket): Promise<{ ticket: Ticket; location: string }> {
  const response = await api.post<unknown>('/tickets', input)
  const location = response.headers.location
  if (typeof location !== 'string' || location.length === 0) {
    invalidResponse('The API created the ticket but did not return a Location header.', response.status, requestId(response))
  }
  return {
    ticket: parseTicket(response.data, response.status, requestId(response)),
    location,
  }
}

export async function updateTicket(id: string, update: TicketUpdate): Promise<Ticket> {
  const response = await api.patch<unknown>(
    `/tickets/${encodeURIComponent(id)}`,
    update,
  )
  return parseTicket(response.data, response.status, requestId(response))
}

export async function deleteTicket(id: string): Promise<void> {
  await api.delete(`/tickets/${encodeURIComponent(id)}`)
}

export async function checkHealth(): Promise<{ ok: boolean; version: string; acceptedCount: number; rejectedCount: number }> {
  const response = await api.get<unknown>('/healthz')
  const data = response.data
  if (
    !isObject(data) ||
    typeof data.ok !== 'boolean' ||
    typeof data.version !== 'string' ||
    typeof data.acceptedCount !== 'number' ||
    typeof data.rejectedCount !== 'number'
  ) {
    invalidResponse('The API returned an invalid health response.', response.status, requestId(response))
  }
  return {
    ok: data.ok,
    version: data.version,
    acceptedCount: data.acceptedCount,
    rejectedCount: data.rejectedCount,
  }
}
