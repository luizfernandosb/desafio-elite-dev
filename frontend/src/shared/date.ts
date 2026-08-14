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

// Chave de dia ("2026-08-14") no fuso do EVENTO -- usada pra agrupar sessões por
// aba de dia na tela de escolher horário (§ catalog/showtimes.ts). `en-CA` dá
// yyyy-mm-dd direto (mesmo truque de `EventEditForm.tsx`, `toDateInputValue`) --
// não usar `toISOString().slice(0, 10)`, que é sempre UTC, nunca o fuso do evento.
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

// Só o horário ("21:00"), no fuso do EVENTO -- os botões de sessão mostram
// data (uma vez, na aba do dia) e horário (por botão) separados, nunca juntos.
export function formatEventTime(utcDate: string | Date, timezone: string): string {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate
  return new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    date,
  )
}

const WEEKDAY_ABBREVIATIONS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

// Rótulo de aba de dia ("HOJE", "AMANHÃ", ou "SÁB" pros demais) + "14/08" -- os dois
// primeiros dias ganham nome especial (é o que o cliente realmente pensa, não "TER"
// quando hoje é terça); os demais usam o dia da semana abreviado. `dateKey` (não uma
// conta de diferença de dias) evita drift de fuso: o dia 0 é sempre o dia de HOJE no
// fuso do evento, e comparar string 'yyyy-mm-dd' nunca erra por causa de DST.
export function dayTabLabel(dateKey: string, timezone: string, now: Date = new Date()): { label: string; shortDate: string } {
  const todayKey = toEventDateKey(now, timezone)
  const tomorrowKey = toEventDateKey(new Date(now.getTime() + 86_400_000), timezone)
  // `dateKey` é "yyyy-mm-dd" (fuso do evento, não UTC) -- construído como meio-dia
  // local só pra extrair o dia da semana e "dd/mm" sem risco de cair no dia anterior
  // por causa de fuso (meio-dia nunca cruza a virada de dia em nenhum fuso terrestre)
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
