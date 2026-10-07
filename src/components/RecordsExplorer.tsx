import { useEffect, useMemo, useState } from 'react'
import type { ParsedCsv } from '../lib/parseCsv'
import {
  filterRecords,
  type SortOrder,
  type StatusFilter,
  type ZoneFilter,
} from '../lib/filterRecords'
import { calculateWorkload } from '../lib/workloadMetrics'
import {
  createAnalysisExport,
  type AnalysisExport,
} from '../lib/analysisExport'
import { MatchingTickets } from './MatchingTickets'
import './RecordsExplorer.css'

interface RecordsExplorerProps {
  dataset: (ParsedCsv & {
    fileName: string
    acceptedCount: number
    rejectedCount: number
    loadId: number
  }) | null
  onAnalysisChange: (analysis: AnalysisExport | null) => void
}

function isZoneFilter(value: string): value is ZoneFilter {
  return ['all', 'North', 'Central', 'South'].includes(value)
}

function isStatusFilter(value: string): value is StatusFilter {
  return ['all', 'Open', 'Closed'].includes(value)
}

function isSortOrder(value: string): value is SortOrder {
  return value === 'ticketId' || value === 'oldest' || value === 'newest'
}

export function RecordsExplorer({
  dataset,
  onAnalysisChange,
}: RecordsExplorerProps) {
  const [search, setSearch] = useState('')
  const [zone, setZone] = useState<ZoneFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('ticketId')

  const filteredRows = useMemo(() => {
    if (!dataset) return []

    return filterRecords(dataset.headers, dataset.rows, {
      search,
      zone,
      status,
      sortOrder,
    })
  }, [dataset, search, sortOrder, status, zone])

  const workload = useMemo(
    () => calculateWorkload(dataset?.headers ?? [], filteredRows),
    [dataset, filteredRows],
  )
  const zoneWorkloads = useMemo(
    () =>
      (['North', 'Central', 'South'] as const).map((zoneName) => ({
        zone: zoneName,
        metrics: calculateWorkload(
          dataset?.headers ?? [],
          filteredRows
            .filter((row) => {
              const zoneIndex = dataset?.headers.indexOf('zone') ?? -1
              return (row[zoneIndex] ?? '') === zoneName
            }),
        ),
      })),
    [dataset, filteredRows],
  )
  const analysis = useMemo(
    () =>
      dataset
        ? createAnalysisExport(
            dataset.fileName,
            dataset.acceptedCount,
            dataset.rejectedCount,
            dataset.headers,
            filteredRows,
            { search, zone, status },
            sortOrder,
            workload,
            zoneWorkloads,
          )
        : null,
    [dataset, filteredRows, search, sortOrder, status, workload, zone, zoneWorkloads],
  )

  useEffect(() => {
    onAnalysisChange(analysis)
  }, [analysis, onAnalysisChange])

  function resetFilters() {
    setSearch('')
    setZone('all')
    setStatus('all')
    setSortOrder('ticketId')
  }

  if (dataset) {
    return (
      <>
      <section className="records-explorer" aria-labelledby="records-explorer-title">
        <div className="records-explorer__heading">
          <h2 id="records-explorer-title">Explore the records</h2>
          <button
            className="records-explorer__reset"
            type="button"
            onClick={resetFilters}
          >
            Reset filters
          </button>
        </div>

        <div className="records-explorer__filters">
          <label className="records-explorer__field records-explorer__search">
            <span>Search ID or summary</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="e.g. inspection"
            />
          </label>

          <label className="records-explorer__field">
            <span>Zone</span>
            <select
              value={zone}
              onChange={(event) => {
                if (isZoneFilter(event.target.value)) setZone(event.target.value)
              }}
            >
              <option value="all">All zones</option>
              <option value="North">North</option>
              <option value="Central">Central</option>
              <option value="South">South</option>
            </select>
          </label>

          <label className="records-explorer__field">
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => {
                if (isStatusFilter(event.target.value)) {
                  setStatus(event.target.value)
                }
              }}
            >
              <option value="all">All statuses</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
            </select>
          </label>

          <label className="records-explorer__field">
            <span>Sort by</span>
            <select
              value={sortOrder}
              onChange={(event) => {
                if (isSortOrder(event.target.value)) {
                  setSortOrder(event.target.value)
                }
              }}
            >
              <option value="ticketId">Ticket ID order</option>
              <option value="oldest">Oldest opening first</option>
              <option value="newest">Newest opening first</option>
            </select>
          </label>
        </div>

        <section
          className="records-explorer__workload"
          aria-labelledby="records-explorer-workload-title"
        >
          <h3 id="records-explorer-workload-title">Matching workload</h3>
          <p className="records-explorer__intro">
            All matching records, not just the displayed page. Reference date:
            {' '}2026-04-01 (UTC).
          </p>
          <dl className="records-explorer__metrics">
            <div>
              <dt>Matching tickets</dt>
              <dd>{workload.matchingTickets.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Open tickets</dt>
              <dd>{workload.openTickets.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Overdue open</dt>
              <dd>{workload.overdueOpen.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Known open hours</dt>
              <dd>{workload.knownOpenHours.toLocaleString()}</dd>
            </div>
          </dl>
          <p className="records-explorer__coverage">
            {workload.knownOpenCount} of {workload.openTickets} open tickets estimated;{' '}
            {workload.unknownOpenCount} unknown.
          </p>
          <p className="records-explorer__zone-caption">
            Compare zones within the current filters
          </p>
          <div
            className="records-explorer__zone-table-wrap"
            role="region"
            aria-label="Zone workload comparison table; scroll horizontally to see all columns"
            tabIndex={0}
          >
            <table className="records-explorer__zone-table">
              <thead>
                <tr>
                  <th scope="col">Zone</th>
                  <th scope="col">Matching</th>
                  <th scope="col">Open</th>
                  <th scope="col">Overdue open</th>
                  <th scope="col">Known hours</th>
                  <th scope="col">Estimate coverage</th>
                </tr>
              </thead>
              <tbody>
                {zoneWorkloads.map(({ zone: zoneName, metrics }) => (
                  <tr key={zoneName}>
                    <th scope="row">{zoneName}</th>
                    <td>{metrics.matchingTickets.toLocaleString()}</td>
                    <td>{metrics.openTickets.toLocaleString()}</td>
                    <td>{metrics.overdueOpen.toLocaleString()}</td>
                    <td>{metrics.knownOpenHours.toLocaleString()}</td>
                    <td>
                      {metrics.knownOpenCount} of {metrics.openTickets} open tickets estimated;{' '}
                      {metrics.unknownOpenCount} unknown.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="records-explorer__zone-note">
            Overdue means open for at least 14 days. Ticket counts are not
            population-adjusted incident rates.
          </p>
        </section>

      </section>
      <MatchingTickets
        key={`${dataset.loadId}-${search}-${zone}-${status}-${sortOrder}`}
        headers={dataset.headers}
        rows={filteredRows}
      />
      </>
    )
  }

  return (
    <section
      className="records-explorer-empty"
      aria-labelledby="records-explorer-title"
    >
      <h2 id="records-explorer-title">
        Start with the evidence, not a guess.
      </h2>
      <p>
        Choose a supplied CSV to compare open tickets, overdue work, and
        estimate coverage. The import report will explain any records that
        cannot be used.
      </p>
    </section>
  )
}

export default RecordsExplorer
