import { AppError } from './errors'

interface ValidatableEvent {
  startsAt: Date
  endsAt: Date | null
}

// Janela em que a portaria pode validar ingressos de um evento: 2h antes do início
// até o fim, ou até 6h após o início se o evento não tiver `endsAt`. §4.6.3
export function assertValidationWindow(event: ValidatableEvent): void {
  const now = new Date()
  const opens = new Date(event.startsAt.getTime() - 2 * 60 * 60 * 1000)
  const closes = event.endsAt ?? new Date(event.startsAt.getTime() + 6 * 60 * 60 * 1000)

  if (now < opens) throw new AppError('GATE_TOO_EARLY', 'Portaria ainda não abriu')
  if (now > closes) throw new AppError('GATE_CLOSED', 'Evento já encerrado')
}
