import Papa from 'papaparse'

export interface ParsedCsv {
  headers: string[]
  rows: string[][]
}

export function parseCsv(text: string): ParsedCsv {
  const result = Papa.parse<string[]>(text, {
    delimiter: ',',
    dynamicTyping: false,
    header: false,
    skipEmptyLines: false,
  })

  if (result.errors.length > 0) {
    const [parseError] = result.errors
    const line = parseError.row === undefined ? '' : ` on line ${parseError.row + 1}`
    throw new Error(`Could not parse CSV${line}: ${parseError.message}`)
  }

  const [headerRecord, ...rows] = result.data
  if (
    !headerRecord ||
    headerRecord.length === 0 ||
    headerRecord.every((value) => value.trim() === '')
  ) {
    throw new Error('CSV must include a header row.')
  }

  if (headerRecord[0].startsWith('\uFEFF')) {
    headerRecord[0] = headerRecord[0].slice(1)
  }

  return { headers: headerRecord, rows }
}
