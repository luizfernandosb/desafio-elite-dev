import type { TicketStatus } from './api'

export function ticketStatusLabel(status: TicketStatus): string {
  if (status === 'ACTIVE') return 'Ativo'
  if (status === 'USED') return 'Usado'
  return 'Cancelado'
}

export function ticketStatusVariant(status: TicketStatus): 'success' | 'warning' | 'danger' {
  if (status === 'ACTIVE') return 'success'
  if (status === 'USED') return 'warning'
  return 'danger'
}
