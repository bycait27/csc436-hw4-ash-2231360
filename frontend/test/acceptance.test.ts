import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createAnalysisExport } from '../src/lib/analysisExport'
import { filterRecords } from '../src/lib/filterRecords'
import { parseCsv } from '../src/lib/parseCsv'
import { validateRecords } from '../src/lib/validateRecords'
import { calculateWorkload } from '../src/lib/workloadMetrics'

const verificationCsv = readFileSync(
  new URL('../../data/verification.csv', import.meta.url),
  'utf8',
)
const edgeCasesCsv = readFileSync(
  new URL('../../data/edge-cases.csv', import.meta.url),
  'utf8',
)

function loadValidCsv(text: string) {
  const parsed = parseCsv(text)
  const validation = validateRecords(parsed)

  return {
    headers: parsed.headers,
    rows: validation.acceptedRows,
    rejectedRecords: validation.rejectedRecords,
    ignoredCount: validation.ignoredCount,
  }
}

describe('dataset acceptance cases', () => {
  it('A1 verification.csv: normalized records, independent metrics, and blank versus zero', () => {
    const dataset = loadValidCsv(verificationCsv)

    expect(dataset.rejectedRecords).toHaveLength(0)
    expect(dataset.rows).toHaveLength(8)
    expect(dataset.rows.every((row) => row.every((field) => typeof field === 'string'))).toBe(true)
    expect(dataset.rows.every((row) => row.every((field) => field === field.trim()))).toBe(true)

    const allMetrics = calculateWorkload(dataset.headers, dataset.rows)
    expect(allMetrics).toEqual({
      matchingTickets: 8,
      openTickets: 6,
      overdueOpen: 3,
      knownOpenHours: 14,
      knownOpenCount: 4,
      unknownOpenCount: 2,
    })

    const northOpenRows = filterRecords(dataset.headers, dataset.rows, {
      search: '',
      zone: 'North',
      status: 'Open',
      sortOrder: 'ticketId',
    })
    expect(calculateWorkload(dataset.headers, northOpenRows)).toEqual({
      matchingTickets: 2,
      openTickets: 2,
      overdueOpen: 1,
      knownOpenHours: 4,
      knownOpenCount: 1,
      unknownOpenCount: 1,
    })

    const estimateIndex = dataset.headers.indexOf('estimated_hours')
    expect(dataset.rows.find((row) => row[0] === 'T-00001')?.[estimateIndex]).toBe('4')
    expect(dataset.rows.find((row) => row[0] === 'T-00002')?.[estimateIndex]).toBe('')
    expect(dataset.rows.find((row) => row[0] === 'T-00005')?.[estimateIndex]).toBe('0')
    expect(typeof allMetrics.knownOpenHours).toBe('number')
    expect(
      Object.values(allMetrics).every((metric) => Number.isFinite(metric)),
    ).toBe(true)

    const allRecordsExport = createAnalysisExport(
      'verification.csv',
      dataset.rows.length,
      dataset.rejectedRecords.length,
      dataset.headers,
      dataset.rows,
      { search: '', zone: 'all', status: 'all' },
      'ticketId',
      allMetrics,
      [],
    )
    expect(allRecordsExport.metrics).toEqual({
      matchingCount: 8,
      openCount: 6,
      overdueOpenCount: 3,
      knownOpenHours: 14,
      knownOpenCount: 4,
      unknownOpenCount: 2,
    })

    const northOpenExport = createAnalysisExport(
      'verification.csv',
      dataset.rows.length,
      dataset.rejectedRecords.length,
      dataset.headers,
      northOpenRows,
      { search: '', zone: 'North', status: 'Open' },
      'ticketId',
      calculateWorkload(dataset.headers, northOpenRows),
      [],
    )
    expect(northOpenExport.metrics).toEqual({
      matchingCount: 2,
      openCount: 2,
      overdueOpenCount: 1,
      knownOpenHours: 4,
      knownOpenCount: 1,
      unknownOpenCount: 1,
    })
  })

  it('A2 edge-cases.csv: reconciles counts, first-valid duplicates, and literal quoted/newline text', () => {
    const dataset = loadValidCsv(edgeCasesCsv)

    expect(dataset.rows).toHaveLength(5)
    expect(dataset.rejectedRecords).toHaveLength(17)
    expect(dataset.ignoredCount).toBe(2)
    expect(
      dataset.rows.map((row) => row[dataset.headers.indexOf('ticket_id')]),
    ).toContain('T-00990')
    expect(
      dataset.rejectedRecords.find((record) => record.ticketId === 'T-00990')?.reason,
    ).toMatch(/Opened date/)
    expect(
      dataset.rows.filter((row) => row[dataset.headers.indexOf('ticket_id')] === 'T-00991'),
    ).toHaveLength(1)
    expect(
      dataset.rejectedRecords.find((record) => record.ticketId === 'T-00991')?.reason,
    ).toMatch(/duplicates an already accepted record/)

    const summaryIndex = dataset.headers.indexOf('summary')
    const multilineSummary = dataset.rows.find(
      (row) => row[dataset.headers.indexOf('ticket_id')] === 'T-00991',
    )?.[summaryIndex]
    expect(multilineSummary).toContain('"A"')
    expect(multilineSummary).toContain('\n')
    expect(
      dataset.rows.find((row) => row[dataset.headers.indexOf('ticket_id')] === 'T-01000')?.[summaryIndex],
    ).toBe('<b>Inspect me</b>')
    expect(
      dataset.rows.find((row) => row[dataset.headers.indexOf('ticket_id')] === 'T-01001')?.[summaryIndex],
    ).toBe('=1+1')
  })

  it('Combined filters and sorting: preserves source rows and exports matching rows and metrics', () => {
    const dataset = loadValidCsv(verificationCsv)
    const originalRows = structuredClone(dataset.rows)
    const filteredRows = filterRecords(dataset.headers, dataset.rows, {
      search: 'T-0000',
      zone: 'North',
      status: 'Open',
      sortOrder: 'newest',
    })

    expect(filteredRows.map((row) => row[0])).toEqual(['T-00002', 'T-00001'])
    expect(dataset.rows).toEqual(originalRows)
    const metrics = calculateWorkload(dataset.headers, filteredRows)
    expect(metrics).toEqual({
      matchingTickets: 2,
      openTickets: 2,
      overdueOpen: 1,
      knownOpenHours: 4,
      knownOpenCount: 1,
      unknownOpenCount: 1,
    })

    const report = createAnalysisExport(
      'verification.csv',
      dataset.rows.length,
      dataset.rejectedRecords.length,
      dataset.headers,
      filteredRows,
      { search: 'T-0000', zone: 'North', status: 'Open' },
      'newest',
      metrics,
      ['North', 'Central', 'South'].map((zone) => ({
        zone,
        metrics: calculateWorkload(
          dataset.headers,
          filteredRows.filter((row) => row[dataset.headers.indexOf('zone')] === zone),
        ),
      })),
    )

    expect(report.source).toEqual({
      fileName: 'verification.csv',
      acceptedCount: 8,
      rejectedCount: 0,
    })
    expect(report.filters).toEqual({
      search: 'T-0000',
      zone: 'North',
      status: 'Open',
    })
    expect(report.sort).toEqual({
      field: 'opened_on',
      direction: 'descending',
    })
    expect(report.metrics).toEqual({
      matchingCount: 2,
      openCount: 2,
      overdueOpenCount: 1,
      knownOpenHours: 4,
      knownOpenCount: 1,
      unknownOpenCount: 1,
    })
    expect(report.matchingRows).toHaveLength(2)
    expect(report.matchingRows.map((row) => row.ticket_id)).toEqual([
      'T-00002',
      'T-00001',
    ])
    expect(report.zoneSummaries.map(({ zone }) => zone)).toEqual([
      'North',
      'Central',
      'South',
    ])
    expect(JSON.parse(JSON.stringify(report)).matchingRows).toHaveLength(2)
  })
})
