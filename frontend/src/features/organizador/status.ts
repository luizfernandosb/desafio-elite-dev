import type { EventStatus } from './api'

export function eventStatusLabel(status: EventStatus): string {
  if (status === 'DRAFT') return 'Rascunho'
  if (status === 'PUBLISHED') return 'Publicada'
  return 'Cancelada'
}
