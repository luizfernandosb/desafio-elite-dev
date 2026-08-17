import { AppError } from './errors'

interface ValidatableEvent {
  startsAt: Date
  endsAt: Date | null
}

export const MIN_EVENT_LEAD_MS = 60 * 60 * 1000

export function isFutureEventStart(startsAt: Date, now: Date = new Date()): boolean {
  return startsAt.getTime() - now.getTime() >= MIN_EVENT_LEAD_MS
}

export function gateWindowCloses(event: ValidatableEvent): Date {
  return event.endsAt ?? new Date(event.startsAt.getTime() + 6 * 60 * 60 * 1000)
}

export function assertValidationWindow(event: ValidatableEvent): void {
  const now = new Date()
  const opens = new Date(event.startsAt.getTime() - 2 * 60 * 60 * 1000)
  const closes = gateWindowCloses(event)

  if (now < opens) throw new AppError('GATE_TOO_EARLY', 'Portaria ainda não abriu')
  if (now > closes) throw new AppError('GATE_CLOSED', 'Evento já encerrado')
}

export function computeShareExpiresAt(event: ValidatableEvent): Date {
  const sixHoursAfterStart = new Date(event.startsAt.getTime() + 6 * 60 * 60 * 1000)
  const gateCloses = gateWindowCloses(event)
  return sixHoursAfterStart < gateCloses ? sixHoursAfterStart : gateCloses
}
