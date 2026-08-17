export function formatEventDate(utcDate: string | Date, timezone: string): string {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date)
}

export function toEventDateKey(utcDate: string | Date, timezone: string): string {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}

export function formatEventTime(utcDate: string | Date, timezone: string): string {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate
  return new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    date,
  )
}

const WEEKDAY_ABBREVIATIONS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

export function dayTabLabel(dateKey: string, timezone: string, now: Date = new Date()): { label: string; shortDate: string } {
  const todayKey = toEventDateKey(now, timezone)
  const tomorrowKey = toEventDateKey(new Date(now.getTime() + 86_400_000), timezone)
  const [year, month, day] = dateKey.split('-').map(Number)
  const referenceDate = new Date(Date.UTC(year!, month! - 1, day!, 12))
  const shortDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' }).format(
    referenceDate,
  )
  if (dateKey === todayKey) return { label: 'Hoje', shortDate }
  if (dateKey === tomorrowKey) return { label: 'Amanhã', shortDate }
  const weekday = WEEKDAY_ABBREVIATIONS[referenceDate.getUTCDay()]!
  return { label: weekday, shortDate }
}

export function formatRelative(targetDate: string | Date, now: Date = new Date()): string {
  const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate
  const diffMs = target.getTime() - now.getTime()
  if (diffMs <= 0) return 'expirado'

  const totalSeconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}
