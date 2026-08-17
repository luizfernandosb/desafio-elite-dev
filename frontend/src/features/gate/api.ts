import { api } from '../../lib/api'

export type ValidationResult =
  | 'VALID'
  | 'INVALID_SIGNATURE'
  | 'NOT_FOUND'
  | 'ALREADY_USED'
  | 'WRONG_EVENT'
  | 'CANCELLED_TICKET'
  | 'GATE_TOO_EARLY'
  | 'GATE_CLOSED'

export interface GateTicketView {
  seat: string | null
  eventTitle: string
}

export interface GateValidationResponse {
  result: ValidationResult
  ticket: GateTicketView | null
  usedAt: string | null
  validatedBy: string | null
  message: string
}

export interface GateLastValidation {
  result: ValidationResult
  createdAt: string
  ticketId: string | null
}

export interface GateStats {
  total: number
  used: number
  remaining: number
  lastValidations: GateLastValidation[]
}

export const gateKeys = {
  stats: (eventId: string) => ['gate', 'stats', eventId] as const,
}

export function validateTicket(code: string, eventId: string) {
  return api.post<GateValidationResponse>('/gate/validate', { code, eventId })
}

export function getGateStats(eventId: string) {
  return api.get<GateStats>(`/gate/events/${eventId}/stats`)
}
