import { api } from '../../lib/api'

// Espelha o enum `ValidationResult` do back (`schema.prisma`) -- oito valores, não
// quatro: os quatro "oficiais" do desenho visual (§5.1.1) mais dois de janela de
// tempo (`GATE_TOO_EARLY`/`GATE_CLOSED`) e dois que a UI agrupa no mesmo balde
// visual de "inválido" (`NOT_FOUND`, `CANCELLED_TICKET`) -- ver `status.ts`.
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

// `ticket` só vem preenchido em VALID e ALREADY_USED (back: `gate.service.ts`,
// `negativeResult`) -- nos outros seis fica `null` de propósito, nunca um objeto
// vazio que a UI teria que aprender a distinguir de "sem dado".
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

// sempre 200, mesmo para os seis resultados negativos (back: `gate.controller.ts`,
// "nenhum deles é erro da requisição") -- só rejeita por erro de verdade (rede, 401,
// rate limit), nunca por "ingresso inválido"
export function validateTicket(code: string, eventId: string) {
  return api.post<GateValidationResponse>('/gate/validate', { code, eventId })
}

export function getGateStats(eventId: string) {
  return api.get<GateStats>(`/gate/events/${eventId}/stats`)
}
