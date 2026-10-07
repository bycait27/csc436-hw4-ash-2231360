import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadTicketData, parseTicketData } from '../src/ticketData'

const campusTicketsPath = fileURLToPath(new URL('../../data/campus-tickets.csv', import.meta.url))
const verificationPath = new URL('../../data/verification.csv', import.meta.url)

describe('backend ticket data loader', () => {
  it('loads validated campus tickets and reports rejected records', async () => {
    const loaded = await loadTicketData(campusTicketsPath)
    expect(loaded.tickets.length).toBeGreaterThan(0)
    expect(loaded.rejectedRecords).toHaveLength(0)
    expect(loaded.tickets[0]).toMatchObject({
      ticket_id: 'T-00001', zone: 'North', category: 'Comfort', priority: 'Normal',
    })
  })

  it('preserves empty estimates as null and zero estimates as zero', async () => {
    const { tickets } = parseTicketData(await readFile(verificationPath, 'utf8'))
    expect(tickets.find(({ ticket_id }) => ticket_id === 'T-00002')?.estimated_hours).toBeNull()
    expect(tickets.find(({ ticket_id }) => ticket_id === 'T-00005')?.estimated_hours).toBe(0)
  })

  it('rejects files that do not match the ticket header contract', () => {
    expect(() => parseTicketData(
      'ticket_id,zone,category,priority,opened_on,closed_on,estimated_hours\n',
    )).toThrow(/must contain exactly these headers/)
  })

  it('reports invalid records while retaining valid records', () => {
    const invalidCsv = [
      'ticket_id,zone,category,priority,opened_on,closed_on,estimated_hours,summary',
      'T-00001,North,Comfort,Normal,2026-02-22,,,',
      'T-00002,South,Access,High,2026-02-23,,2,Door check',
    ].join('\n')
    const loaded = parseTicketData(invalidCsv)
    expect(loaded.tickets.map(({ ticket_id }) => ticket_id)).toEqual(['T-00002'])
    expect(loaded.rejectedRecords).toHaveLength(1)
    expect(loaded.rejectedRecords[0].issues).toContainEqual({
      field: 'summary', message: 'Summary must not be empty.',
    })
  })
})