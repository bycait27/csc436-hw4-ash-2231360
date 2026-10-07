import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { loadTicketData, type Ticket } from '../src/ticketData'

const verificationPath = fileURLToPath(new URL('../../data/verification.csv', import.meta.url))
let fixtureTickets: Ticket[] = []

interface Metrics {
  matchingCount: number
  openCount: number
  overdueOpenCount: number
  knownOpenHours: number
  knownOpenCount: number
  unknownOpenCount: number
}
interface SummaryBody { asOf: string; metrics: Metrics; byZone: Array<{ zone: string }> }
interface ListBody { page: number; pageSize: number; matchingCount: number; totalPages: number; items: Ticket[] }
interface ErrorBody { error: { code: string; details: Array<{ field: string }> } }
interface HealthBody { ok: boolean; version: string; acceptedCount: number }
async function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>
}

async function withApi(run: (baseUrl: string) => Promise<void>, allowWrites = true) {
  const server = createServer(createApp({ tickets: fixtureTickets, allowWrites }))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as AddressInfo
  try {
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
}

beforeAll(async () => {
  fixtureTickets = (await loadTicketData(verificationPath)).tickets
})

describe('Task 1 named backend API tests', () => {
  it('1. returns hand-checked summary metrics for all and North/open tickets', async () => {
    await withApi(async (baseUrl) => {
      const all = await json<SummaryBody>(await fetch(`${baseUrl}/api/summary`))
      expect(all.metrics).toEqual({
        matchingCount: 8, openCount: 6, overdueOpenCount: 3,
        knownOpenHours: 14, knownOpenCount: 4, unknownOpenCount: 2,
      })
      expect(all.asOf).toBe('2026-04-01')
      expect(all.byZone.map(({ zone }) => zone)).toEqual(['North', 'Central', 'South'])

      const north = await json<SummaryBody>(await fetch(`${baseUrl}/api/summary?zone=North&status=open`))
      expect(north.metrics).toEqual({
        matchingCount: 2, openCount: 2, overdueOpenCount: 1,
        knownOpenHours: 4, knownOpenCount: 1, unknownOpenCount: 1,
      })
      const unknown = await json<Ticket>(await fetch(`${baseUrl}/api/tickets/T-00002`))
      const zero = await json<Ticket>(await fetch(`${baseUrl}/api/tickets/T-00005`))
      expect(unknown.estimated_hours).toBeNull()
      expect(zero.estimated_hours).toBe(0)
    })
  })

  it('2. returns field-specific 400 details and a 409 for duplicate ticket ids', async () => {
    await withApi(async (baseUrl) => {
      const request = (ticket_id: string, summary: string) => fetch(`${baseUrl}/api/tickets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id, zone: 'North', category: 'Access', priority: 'High',
          opened_on: '2026-03-31', closed_on: null, estimated_hours: null, summary }),
      })
      const invalid = await request('T-00999', 'x'.repeat(241))
      expect(invalid.status).toBe(400)
      expect((await json<ErrorBody>(invalid)).error.details).toContainEqual(expect.objectContaining({ field: 'summary' }))
      const duplicate = await request('T-00001', 'Door sensor offline')
      expect(duplicate.status).toBe(409)
      expect((await json<ErrorBody>(duplicate)).error.code).toBe('duplicate_ticket_id')
    })
  })

  it('rejects an empty ticket body instead of returning an internal error', async () => {
    await withApi(async (baseUrl) => {
      for (const body of ['{}', '']) {
        const response = await fetch(`${baseUrl}/api/tickets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        expect(response.status).toBe(400)
        const result = await json<ErrorBody>(response)
        expect(result.error.code).toBe('invalid_ticket')
        expect(result.error.details).toContainEqual(expect.objectContaining({ field: 'ticket_id' }))
      }
    })
  })

  it.todo('3. CORS preflight from allowed and disallowed origins is covered in Task 2')
})

describe('ticket API behavior', () => {
  it('filters, sorts, paginates, and rejects invalid query values', async () => {
    await withApi(async (baseUrl) => {
      const list = await json<ListBody>(await fetch(`${baseUrl}/api/tickets?zone=South&status=open&sort=hours-desc`))
      expect(list).toMatchObject({ page: 1, pageSize: 50, matchingCount: 2, totalPages: 1 })
      expect(list.items.map(({ ticket_id }) => ticket_id)).toEqual(['T-00008', 'T-00007'])
      for (const query of ['zone=West', 'status=resolved', 'sort=newest', 'page=0', 'page=1.5']) {
        expect((await fetch(`${baseUrl}/api/tickets?${query}`)).status).toBe(400)
      }
    })
  })

  it('validates lookup ids and PATCH dates, then creates, updates, and deletes tickets', async () => {
    await withApi(async (baseUrl) => {
      expect((await fetch(`${baseUrl}/api/tickets/bad-id`)).status).toBe(400)
      expect((await fetch(`${baseUrl}/api/tickets/T-99999`)).status).toBe(404)
      const badPatch = await fetch(`${baseUrl}/api/tickets/T-00001`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closed_on: '2026-02-28' }),
      })
      expect(badPatch.status).toBe(400)
      expect((await json<ErrorBody>(badPatch)).error.details).toContainEqual(expect.objectContaining({ field: 'closed_on' }))
      const created = await fetch(`${baseUrl}/api/tickets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: 'T-00999', zone: 'North', category: 'Access', priority: 'High',
          opened_on: '2026-03-31', closed_on: null, estimated_hours: null, summary: 'Door sensor offline' }),
      })
      expect(created.status).toBe(201)
      expect(created.headers.get('location')).toBe('/api/tickets/T-00999')
      const updated = await fetch(`${baseUrl}/api/tickets/T-00999`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closed_on: '2026-04-01' }),
      })
      expect((await json<Ticket>(updated)).closed_on).toBe('2026-04-01')
      const deleted = await fetch(`${baseUrl}/api/tickets/T-00999`, { method: 'DELETE' })
      expect(deleted.status).toBe(204)
      expect(await deleted.text()).toBe('')
      expect((await fetch(`${baseUrl}/api/tickets/T-00999`)).status).toBe(404)
    })
  })

  it('returns request ids and the shared error shape, including malformed JSON', async () => {
    await withApi(async (baseUrl) => {
      const health = await fetch(`${baseUrl}/api/healthz`, { headers: { 'X-Request-Id': 'test-request' } })
      expect(health.headers.get('x-request-id')).toBe('test-request')
      expect(await json<HealthBody>(health)).toMatchObject({ ok: true, version: '1.0.0', acceptedCount: 8 })
      expect((await fetch(`${baseUrl}/api/healthz`)).headers.get('x-request-id')).toBeTruthy()
      const malformed = await fetch(`${baseUrl}/api/tickets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'bad-json' }, body: '{',
      })
      expect(malformed.status).toBe(400)
      expect(malformed.headers.get('x-request-id')).toBe('bad-json')
      expect(await json<ErrorBody>(malformed)).toMatchObject({ error: { code: 'invalid_json', details: [] } })
      const missing = await fetch(`${baseUrl}/api/not-found`)
      expect(missing.status).toBe(404)
      expect(await json<ErrorBody>(missing)).toMatchObject({ error: { code: 'not_found', details: [] } })
    })
  })

  it('disables POST, PATCH, and DELETE when read-only mode is configured', async () => {
    await withApi(async (baseUrl) => {
      for (const [url, method] of [
        [`${baseUrl}/api/tickets`, 'POST'],
        [`${baseUrl}/api/tickets/T-00001`, 'PATCH'],
        [`${baseUrl}/api/tickets/T-00001`, 'DELETE'],
      ] as const) {
        const response = await fetch(url, { method })
        expect(response.status).toBe(403)
        expect((await json<ErrorBody>(response)).error.code).toBe('read_only')
      }
    }, false)
  })
})