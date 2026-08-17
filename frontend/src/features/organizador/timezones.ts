import { CalendarDateTime } from '@internationalized/date'

export interface TimezoneOption {
  value: string
  label: string
}

export const BRAZIL_TIMEZONES: TimezoneOption[] = [
  { value: 'America/Sao_Paulo', label: 'Brasília' },
  { value: 'America/Manaus', label: 'Manaus' },
  { value: 'America/Rio_Branco', label: 'Rio Branco' },
  { value: 'America/Noronha', label: 'Fernando de Noronha' },
]

export function timezoneLabel(value: string): string {
  return BRAZIL_TIMEZONES.find((tz) => tz.value === value)?.label ?? value
}

export function zonedWallTimeToUtcDate(date: string, time: string, timezone: string): Date {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const [hour, minute] = time.split(':').map(Number) as [number, number]
  const wallTime = new CalendarDateTime(year, month, day, hour, minute)
  return wallTime.toDate(timezone)
}

export function describeLocalTime(date: string, time: string, timezone: string): string {
  const utcInstant = zonedWallTimeToUtcDate(date, time, timezone)
  const local = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(utcInstant)
  const utc = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
  }).format(utcInstant)
  return `Sessão às ${local} no horário de ${timezoneLabel(timezone)} (${utc} UTC)`
}
