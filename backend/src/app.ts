import express, {
  type ErrorRequestHandler,
  type RequestHandler,
} from 'express'
import { randomUUID } from 'node:crypto'
import { createStore, type TicketStore } from './store'
import { HttpError, summaryHandler, ticketsRouter } from './tickets.ts'
import type { Ticket } from './ticketData'

export interface AppOptions {
  tickets: Ticket[]
  acceptedCount?: number
  rejectedCount?: number
  allowWrites?: boolean
  store?: TicketStore
  log?: (message: string) => void
}

export function createApp({
  tickets,
  acceptedCount = tickets.length,
  rejectedCount = 0,
  allowWrites = true,
  store = createStore(tickets),
  log = console.error,
}: AppOptions) {
  const app = express()
  app.disable('x-powered-by')

  const requestIds: RequestHandler = (req, res, next) => {
    const incomingId = req.get('X-Request-Id')
    const requestId = incomingId && incomingId.trim() !== '' ? incomingId : randomUUID()
    res.setHeader('X-Request-Id', requestId)
    res.locals.requestId = requestId
    next()
  }
  app.use(requestIds)
  app.use((req, _res, next) => {
    const isTicketWrite =
      ['POST', 'PATCH', 'DELETE'].includes(req.method) &&
      (req.path === '/api/tickets' || req.path.startsWith('/api/tickets/'))
    if (!allowWrites && isTicketWrite) {
      next(new HttpError(403, 'read_only', 'Ticket changes are disabled.'))
      return
    }
    next()
  })
  app.use(express.json({ limit: '16kb' }))

  app.get('/api/healthz', (_req, res) => {
    res.json({
      ok: true,
      version: process.env.API_VERSION ?? '1.0.0',
      acceptedCount,
      rejectedCount,
    })
  })
  app.get('/api/summary', summaryHandler(store))
  app.use('/api/tickets', ticketsRouter(store, allowWrites))

  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'not_found',
        message: `${req.method} ${req.path} was not found.`,
        details: [],
      },
    })
  })

  const errors: ErrorRequestHandler = (error: Error & { status?: number; type?: string }, _req, res, next) => {
    if (res.headersSent) {
      next(error)
      return
    }

    const status = error instanceof HttpError ? error.status : error.status ?? 500
    const code = error instanceof HttpError
      ? error.code
      : error.type === 'entity.parse.failed'
        ? 'invalid_json'
        : error.type === 'entity.too.large'
          ? 'too_large'
          : 'internal_error'
    const message = status >= 500 ? 'Unexpected server error.' : error.message
    const details = error instanceof HttpError ? error.details : []

    if (status >= 500) log(`ERROR ${error.stack ?? error}`)
    res.status(status).json({ error: { code, message, details } })
  }
  app.use(errors)

  return app
}