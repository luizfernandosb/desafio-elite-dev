import type { TicketStatus } from './api'

// Centralizado -- TicketCard, TicketDetailPage e SharedTicketPage mostram o mesmo
// rótulo/cor para o mesmo status, nunca reinventado tela a tela.
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
