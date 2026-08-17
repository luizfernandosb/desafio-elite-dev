import { AppError } from './errors'

interface ValidatableEvent {
  startsAt: Date
  endsAt: Date | null
}

// Antecedência mínima para criar/reagendar uma sessão: pelo menos 1h à frente do
// agora, mesmo no dia atual -- dá tempo de preparar a sala/venda antes do
// horário marcado. Antes disto, qualquer instante estritamente futuro (mesmo 1
// segundo à frente) já passava na validação.
export const MIN_EVENT_LEAD_MS = 60 * 60 * 1000

export function isFutureEventStart(startsAt: Date, now: Date = new Date()): boolean {
  return startsAt.getTime() - now.getTime() >= MIN_EVENT_LEAD_MS
}

// fim da janela de portaria: o próprio `endsAt`, ou 6h após o início se o evento não
// tiver `endsAt` (§4.6.3) -- extraído para ser reaproveitado pelo link de
// compartilhamento (etapa 09), que não sobrevive além desse ponto
export function gateWindowCloses(event: ValidatableEvent): Date {
  return event.endsAt ?? new Date(event.startsAt.getTime() + 6 * 60 * 60 * 1000)
}

// Janela em que a portaria pode validar ingressos de um evento: 2h antes do início
// até o fim. §4.6.3
export function assertValidationWindow(event: ValidatableEvent): void {
  const now = new Date()
  const opens = new Date(event.startsAt.getTime() - 2 * 60 * 60 * 1000)
  const closes = gateWindowCloses(event)

  if (now < opens) throw new AppError('GATE_TOO_EARLY', 'Portaria ainda não abriu')
  if (now > closes) throw new AppError('GATE_CLOSED', 'Evento já encerrado')
}

// validade padrão do link de compartilhamento: até 6h após o início, limitada ao fim
// da janela de portaria -- o link não sobrevive além do momento em que o ingresso já
// não serve para nada (§ etapa 09)
export function computeShareExpiresAt(event: ValidatableEvent): Date {
  const sixHoursAfterStart = new Date(event.startsAt.getTime() + 6 * 60 * 60 * 1000)
  const gateCloses = gateWindowCloses(event)
  return sixHoursAfterStart < gateCloses ? sixHoursAfterStart : gateCloses
}
