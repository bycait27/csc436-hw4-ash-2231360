import type { WorkloadMetrics } from './workloadMetrics'

export interface AnalysisFilters {
  search: string
  zone: string
  status: string
}

export interface ZoneSummary {
  zone: string
  metrics: AnalysisMetrics
}

interface WorkloadZoneSummary {
  zone: string
  metrics: WorkloadMetrics
}

export interface AnalysisMetrics {
  matchingCount: number
  openCount: number
  overdueOpenCount: number
  knownOpenHours: number
  knownOpenCount: number
  unknownOpenCount: number
}

export interface AnalysisExport {
  source: {
    fileName: string
    acceptedCount: number
    rejectedCount: number
  }
  filters: AnalysisFilters
  sort: {
    field: 'ticket_id' | 'opened_on'
    direction: 'ascending' | 'descending'
  }
  metrics: AnalysisMetrics
  zoneSummaries: ZoneSummary[]
  matchingRows: Record<string, string>[]
}

export function createAnalysisExport(
  fileName: string,
  acceptedCount: number,
  rejectedCount: number,
  headers: string[],
  rows: string[][],
  filters: AnalysisFilters,
  sortOrder: 'ticketId' | 'oldest' | 'newest',
  metrics: WorkloadMetrics,
  zoneSummaries: WorkloadZoneSummary[],
): AnalysisExport {
  const matchingRows = rows.map((row) => {
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      record[header] = row[index] ?? ''
    })
    return record
  })

  return {
    source: { fileName, acceptedCount, rejectedCount },
    filters,
    sort: {
      field: sortOrder === 'ticketId' ? 'ticket_id' : 'opened_on',
      direction: sortOrder === 'newest' ? 'descending' : 'ascending',
    },
    metrics: toAnalysisMetrics(metrics),
    zoneSummaries: zoneSummaries.map(({ zone, metrics: summaryMetrics }) => ({
      zone,
      metrics: toAnalysisMetrics(summaryMetrics),
    })),
    matchingRows,
  }
}

function toAnalysisMetrics(metrics: WorkloadMetrics): AnalysisMetrics {
  return {
    matchingCount: metrics.matchingTickets,
    openCount: metrics.openTickets,
    overdueOpenCount: metrics.overdueOpen,
    knownOpenHours: metrics.knownOpenHours,
    knownOpenCount: metrics.knownOpenCount,
    unknownOpenCount: metrics.unknownOpenCount,
  }
}

export function downloadAnalysis(analysis: AnalysisExport): void {
  const blob = new Blob([`${JSON.stringify(analysis, null, 2)}\n`], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'analysis.json'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
