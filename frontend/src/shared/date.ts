// §4.6.3 -- data sempre no fuso do EVENTO, nunca no do navegador. `timezone` é o
// campo IANA salvo no próprio evento (nunca inferido do cliente que está olhando).
export function formatEventDate(utcDate: string | Date, timezone: string): string {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date)
}

// Cronômetro do hold (§4.6.2, TTL de 10 min): "faltam Xm Ys", não uma data absoluta.
// `now` é parâmetro (não `Date.now()` interno) para o teste controlar o relógio.
export function formatRelative(targetDate: string | Date, now: Date = new Date()): string {
  const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate
  const diffMs = target.getTime() - now.getTime()
  if (diffMs <= 0) return 'expirado'

  const totalSeconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}
