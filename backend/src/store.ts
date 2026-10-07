import type { Ticket } from './ticketData'

export interface TicketStore {
  list(): Ticket[]
  get(id: string): Ticket | undefined
  insert(ticket: Ticket): Ticket
  update(id: string, ticket: Ticket): Ticket
  remove(id: string): boolean
}

export function createStore(seed: Ticket[]): TicketStore {
  const tickets = new Map(seed.map((ticket) => [ticket.ticket_id, { ...ticket }]))

  return {
    list: () => [...tickets.values()],
    get: (id) => tickets.get(id),
    insert(ticket) {
      tickets.set(ticket.ticket_id, { ...ticket })
      return tickets.get(ticket.ticket_id)!
    },
    update(id, ticket) {
      tickets.set(id, { ...ticket })
      return tickets.get(id)!
    },
    remove: (id) => tickets.delete(id),
  }
}