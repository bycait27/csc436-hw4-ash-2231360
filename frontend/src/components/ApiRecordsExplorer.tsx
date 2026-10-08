import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import {
  createTicket,
  getSummary,
  listTickets,
  updateTicket,
  type ListQuery,
  type NewTicket,
  type Ticket,
  type TicketMetrics,
  type TicketSort,
  type TicketStatus,
  type TicketSummary,
  type ZoneFilter,
} from '../api/tickets'
import './ApiRecordsExplorer.css'

const EMPTY_METRICS: TicketMetrics = {
  matchingCount: 0,
  openCount: 0,
  overdueOpenCount: 0,
  knownOpenHours: 0,
  knownOpenCount: 0,
  unknownOpenCount: 0,
}

interface TicketForm {
  ticket_id: string
  zone: 'North' | 'Central' | 'South'
  category: 'Access' | 'Comfort' | 'Technology'
  priority: 'Low' | 'Normal' | 'High'
  opened_on: string
  estimated_hours: string
  summary: string
}

const INITIAL_FORM: TicketForm = {
  ticket_id: '',
  zone: 'North',
  category: 'Access',
  priority: 'Normal',
  opened_on: '2026-03-31',
  estimated_hours: '',
  summary: '',
}

function errorMessage(error: ApiError): string | null {
  if (error.kind === 'canceled') return null
  if (error.kind === 'http') return error.message
  if (error.kind === 'timeout') return 'The request timed out. Please retry.'
  return "Can't reach the server. Check that the API is running and this page's origin is allowed."
}

function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

function MetricValues({ metrics }: { metrics: TicketMetrics }) {
  return (
    <>
      <dl className="records-explorer__metrics">
        <div><dt>Matching tickets</dt><dd>{metrics.matchingCount.toLocaleString()}</dd></div>
        <div><dt>Open tickets</dt><dd>{metrics.openCount.toLocaleString()}</dd></div>
        <div><dt>Overdue open</dt><dd>{metrics.overdueOpenCount.toLocaleString()}</dd></div>
        <div><dt>Known open hours</dt><dd>{metrics.knownOpenHours.toLocaleString()}</dd></div>
      </dl>
      <p className="records-explorer__coverage">
        {metrics.knownOpenCount} of {metrics.openCount} open tickets estimated;{' '}
        {metrics.unknownOpenCount} unknown.
      </p>
    </>
  )
}

export function ApiRecordsExplorer() {
  const [search, setSearch] = useState('')
  const [zone, setZone] = useState<ZoneFilter>('all')
  const [status, setStatus] = useState<TicketStatus>('all')
  const [sort, setSort] = useState<TicketSort>('opened-asc')
  const [page, setPage] = useState(1)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [summary, setSummary] = useState<TicketSummary | null>(null)
  const [matchingCount, setMatchingCount] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form, setForm] = useState<TicketForm>(INITIAL_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [formRequestId, setFormRequestId] = useState<string | undefined>()
  const [createdLocation, setCreatedLocation] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionRequestId, setActionRequestId] = useState<string | undefined>()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const filters: ListQuery = { search, zone, status, sort, page }

    void Promise.all([
      listTickets(filters, controller.signal),
      getSummary({ search, zone, status }, controller.signal),
    ])
      .then(([list, nextSummary]) => {
        if (controller.signal.aborted) return
        setTickets(list.items)
        setMatchingCount(list.matchingCount)
        setPageSize(list.pageSize)
        setTotalPages(list.totalPages)
        setSummary(nextSummary)
        if (list.totalPages > 0 && page > list.totalPages) {
          setPage(list.totalPages)
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (isApiError(error) && error.kind === 'canceled')) return
        const normalized = isApiError(error)
          ? error
          : new ApiError('network', "Can't reach the server.")
        setLoadError(errorMessage(normalized))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [page, refreshVersion, search, sort, status, zone])

  function beginQueryChange() {
    setIsLoading(true)
    setLoadError(null)
  }

  function resetFilters() {
    beginQueryChange()
    setSearch('')
    setZone('all')
    setStatus('all')
    setPage(1)
  }

  function setFormValue<K extends keyof TicketForm>(key: K, value: TicketForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => ({ ...current, [key]: '' }))
    setFormError(null)
    setCreatedLocation(null)
  }

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFieldErrors({})
    setFormError(null)
    setFormRequestId(undefined)
    setCreatedLocation(null)
    const ticket: NewTicket = {
      ticket_id: form.ticket_id,
      zone: form.zone,
      category: form.category,
      priority: form.priority,
      opened_on: form.opened_on,
      closed_on: null,
      estimated_hours: form.estimated_hours === '' ? null : Number(form.estimated_hours),
      summary: form.summary,
    }

    try {
      const result = await createTicket(ticket)
      setCreatedLocation(result.location)
      setForm(INITIAL_FORM)
      setPage(1)
      beginQueryChange()
      setRefreshVersion((version) => version + 1)
    } catch (error) {
      const normalized = isApiError(error) ? error : new ApiError('network', "Can't reach the server.")
      setFormError(errorMessage(normalized))
      setFormRequestId(normalized.requestId)
      if (normalized.kind === 'http' && normalized.status === 400) {
        setFieldErrors(Object.fromEntries(
          normalized.details.map(({ field, message }) => [field, message]),
        ))
      }
    }
  }

  async function closeTicket(ticket: Ticket) {
    if (!summary) return
    setUpdatingId(ticket.ticket_id)
    setActionError(null)
    setActionRequestId(undefined)
    try {
      await updateTicket(ticket.ticket_id, { closed_on: summary.asOf })
      beginQueryChange()
      setRefreshVersion((version) => version + 1)
    } catch (error) {
      const normalized = isApiError(error) ? error : new ApiError('network', "Can't reach the server.")
      setActionError(errorMessage(normalized))
      setActionRequestId(normalized.requestId)
    } finally {
      setUpdatingId(null)
    }
  }

  const metrics = summary?.metrics ?? EMPTY_METRICS
  const firstRecord = matchingCount === 0 ? 0 : (page - 1) * pageSize + 1
  const lastRecord = Math.min(page * pageSize, matchingCount)

  return (
    <section className="api-explorer" aria-labelledby="api-explorer-title">
      <div className="records-explorer__heading">
        <div>
          <h2 id="api-explorer-title">Explore tickets from the API</h2>
          <p className="api-explorer__intro">
            Search, filters, summaries, and pages are loaded from the ticket API.
          </p>
        </div>
        <button className="records-explorer__reset" type="button" onClick={resetFilters}>
          Reset filters
        </button>
      </div>

      <div className="records-explorer__filters">
        <label className="records-explorer__field records-explorer__search">
          <span>Search ID or summary</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              beginQueryChange()
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="e.g. inspection"
          />
        </label>
        <label className="records-explorer__field">
          <span>Zone</span>
          <select value={zone} onChange={(event) => {
            beginQueryChange()
            setZone(event.target.value as ZoneFilter)
            setPage(1)
          }}>
            <option value="all">All zones</option>
            <option value="North">North</option>
            <option value="Central">Central</option>
            <option value="South">South</option>
          </select>
        </label>
        <label className="records-explorer__field">
          <span>Status</span>
          <select value={status} onChange={(event) => {
            beginQueryChange()
            setStatus(event.target.value as TicketStatus)
            setPage(1)
          }}>
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label className="records-explorer__field">
          <span>Sort by</span>
          <select value={sort} onChange={(event) => {
            beginQueryChange()
            setSort(event.target.value as TicketSort)
            setPage(1)
          }}>
            <option value="opened-asc">Oldest opening first</option>
            <option value="hours-desc">Known hours, highest first</option>
          </select>
        </label>
      </div>

      {loadError && <p className="api-explorer__error" role="alert">{loadError}</p>}
      {isLoading && <p className="api-explorer__status" role="status">Loading tickets and summary…</p>}

      <section className="records-explorer__workload" aria-labelledby="api-workload-title">
        <h3 id="api-workload-title">Matching workload</h3>
        <p className="records-explorer__intro">All matching records, not only this page. Reference date: {summary?.asOf ?? '—'}.</p>
        <MetricValues metrics={metrics} />
        <p className="records-explorer__zone-caption">Compare zones within the current filters</p>
        <div className="records-explorer__zone-table-wrap" role="region" aria-label="Zone workload comparison table" tabIndex={0}>
          <table className="records-explorer__zone-table">
            <thead><tr>
              <th scope="col">Zone</th><th scope="col">Matching</th><th scope="col">Open</th>
              <th scope="col">Overdue open</th><th scope="col">Known hours</th><th scope="col">Estimate coverage</th>
            </tr></thead>
            <tbody>
              {(summary?.byZone ?? []).map(({ zone: zoneName, metrics: zoneMetrics }) => (
                <tr key={zoneName}>
                  <th scope="row">{zoneName}</th>
                  <td>{zoneMetrics.matchingCount.toLocaleString()}</td>
                  <td>{zoneMetrics.openCount.toLocaleString()}</td>
                  <td>{zoneMetrics.overdueOpenCount.toLocaleString()}</td>
                  <td>{zoneMetrics.knownOpenHours.toLocaleString()}</td>
                  <td>{zoneMetrics.knownOpenCount} of {zoneMetrics.openCount} open tickets estimated; {zoneMetrics.unknownOpenCount} unknown.</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="records-explorer__zone-note">Overdue means open for at least 14 days. Ticket counts are not population-adjusted incident rates.</p>
      </section>

      <section className="matching-tickets" aria-labelledby="api-matching-title">
        <div className="matching-tickets__heading">
          <h2 id="api-matching-title">Matching tickets</h2>
          <p aria-live="polite">
            {matchingCount === 0 ? 'No matching records' : `${firstRecord}–${lastRecord} of ${matchingCount} records`}
          </p>
        </div>
        <p className="matching-tickets__description">
          Unknown estimates stay unknown; closed-ticket hours do not enter open-workload totals.
        </p>
        {actionError && (
          <p className="api-explorer__error" role="alert">
            {actionError}{actionRequestId && <span> Request ID: {actionRequestId}</span>}
          </p>
        )}
        {matchingCount === 0 && !isLoading ? (
          <p className="matching-tickets__empty">
            No tickets match these filters. Change a filter or use Reset filters to see the dataset again.
          </p>
        ) : (
          <div className="matching-tickets__table-wrap" role="region" aria-label="Matching tickets table; scroll horizontally to see all columns" tabIndex={0}>
            <table>
              <thead><tr>
                <th scope="col">Ticket ID</th><th scope="col">Zone</th><th scope="col">Category</th>
                <th scope="col">Priority</th><th scope="col">Opened</th><th scope="col">Closed</th>
                <th scope="col">Estimate (h)</th><th scope="col">Summary</th><th scope="col">Action</th>
              </tr></thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.ticket_id}>
                    <th scope="row">{ticket.ticket_id}</th>
                    <td>{ticket.zone}</td><td>{ticket.category}</td><td>{ticket.priority}</td>
                    <td>{ticket.opened_on}</td><td>{ticket.closed_on ?? <strong>Open</strong>}</td>
                    <td>{ticket.estimated_hours ?? 'Unknown'}</td><td>{ticket.summary}</td>
                    <td>{ticket.closed_on === null ? (
                      <button type="button" className="api-explorer__close-button" disabled={updatingId !== null || !summary} onClick={() => void closeTicket(ticket)}>
                        {updatingId === ticket.ticket_id ? 'Closing…' : 'Close ticket'}
                      </button>
                    ) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <nav className="matching-tickets__pagination" aria-label="Matching ticket pages">
          <button className="matching-tickets__page-button" type="button" disabled={page <= 1 || isLoading} onClick={() => { beginQueryChange(); setPage((current) => current - 1) }}>Previous</button>
          <span aria-live="polite">Page {totalPages === 0 ? 0 : page} of {totalPages} / {pageSize} per page</span>
          <button className="matching-tickets__page-button" type="button" disabled={page >= totalPages || isLoading} onClick={() => { beginQueryChange(); setPage((current) => current + 1) }}>Next</button>
        </nav>
      </section>

      <section className="api-explorer__create" aria-labelledby="create-ticket-title">
        <h2 id="create-ticket-title">Create a ticket</h2>
        <p className="api-explorer__intro">The API validates every field against the shared ticket contract.</p>
        {formError && (
          <p className="api-explorer__error" role="alert">
            {formError}{formRequestId && <span> Request ID: {formRequestId}</span>}
          </p>
        )}
        {createdLocation && <p className="api-explorer__success" role="status">Ticket created. Location: <code>{createdLocation}</code></p>}
        <form className="api-explorer__form" onSubmit={(event) => void submitTicket(event)} noValidate>
          <label className="records-explorer__field">Ticket ID
            <input value={form.ticket_id} onChange={(event) => setFormValue('ticket_id', event.target.value)} aria-invalid={Boolean(fieldErrors.ticket_id)} />
            {fieldErrors.ticket_id && <span className="api-explorer__field-error">{fieldErrors.ticket_id}</span>}
          </label>
          <label className="records-explorer__field">Zone
            <select value={form.zone} onChange={(event) => setFormValue('zone', event.target.value as TicketForm['zone'])}><option>North</option><option>Central</option><option>South</option></select>
            {fieldErrors.zone && <span className="api-explorer__field-error">{fieldErrors.zone}</span>}
          </label>
          <label className="records-explorer__field">Category
            <select value={form.category} onChange={(event) => setFormValue('category', event.target.value as TicketForm['category'])}><option>Access</option><option>Comfort</option><option>Technology</option></select>
            {fieldErrors.category && <span className="api-explorer__field-error">{fieldErrors.category}</span>}
          </label>
          <label className="records-explorer__field">Priority
            <select value={form.priority} onChange={(event) => setFormValue('priority', event.target.value as TicketForm['priority'])}><option>Low</option><option>Normal</option><option>High</option></select>
            {fieldErrors.priority && <span className="api-explorer__field-error">{fieldErrors.priority}</span>}
          </label>
          <label className="records-explorer__field">Opened on
            <input type="date" value={form.opened_on} onChange={(event) => setFormValue('opened_on', event.target.value)} aria-invalid={Boolean(fieldErrors.opened_on)} />
            {fieldErrors.opened_on && <span className="api-explorer__field-error">{fieldErrors.opened_on}</span>}
          </label>
          <label className="records-explorer__field">Estimated hours (optional)
            <input type="number" min="0" max="80" step="0.01" value={form.estimated_hours} onChange={(event) => setFormValue('estimated_hours', event.target.value)} aria-invalid={Boolean(fieldErrors.estimated_hours)} />
            {fieldErrors.estimated_hours && <span className="api-explorer__field-error">{fieldErrors.estimated_hours}</span>}
          </label>
          <label className="records-explorer__field api-explorer__summary-field">Summary
            <input value={form.summary} maxLength={260} onChange={(event) => setFormValue('summary', event.target.value)} aria-invalid={Boolean(fieldErrors.summary)} />
            {fieldErrors.summary && <span className="api-explorer__field-error">{fieldErrors.summary}</span>}
          </label>
          {fieldErrors.closed_on && <p className="api-explorer__field-error">{fieldErrors.closed_on}</p>}
          <button className="api-explorer__submit" type="submit">Create ticket</button>
        </form>
      </section>
    </section>
  )
}
