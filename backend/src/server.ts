import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app'
import { parseCorsOrigins } from './cors-options'
import { loadTicketData } from './ticketData'

async function startServer() {
  const defaultDataFile = fileURLToPath(new URL('../../data/campus-tickets.csv', import.meta.url))
  const dataFile = process.env.DATA_FILE
    ? resolve(process.cwd(), process.env.DATA_FILE)
    : defaultDataFile
  const loaded = await loadTicketData(dataFile)

  console.info(
    `Loaded ${loaded.tickets.length} tickets; rejected ${loaded.rejectedRecords.length}; ignored ${loaded.ignoredCount}.`,
  )
  for (const record of loaded.rejectedRecords) {
    console.warn(`Rejected record ${record.recordNumber} (${record.ticketId}): ${record.reason}`)
  }

  const allowWrites = process.env.ALLOW_WRITES?.toLowerCase() !== 'false'
  const port = Number(process.env.PORT ?? 3001)
  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS)
  const app = createApp({
    tickets: loaded.tickets,
    acceptedCount: loaded.tickets.length,
    rejectedCount: loaded.rejectedRecords.length,
    allowWrites,
    corsOrigins,
  })
  app.listen(port, () => {
    console.info(`Ticket API listening at http://localhost:${port}/api`)
    console.info(`Writes ${allowWrites ? 'enabled' : 'disabled'}.`)
  })
}

startServer().catch((error: unknown) => {
  console.error('Could not start the ticket API.', error)
  process.exitCode = 1
})