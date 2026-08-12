import { CalendarDateTime } from '@internationalized/date'

export interface TimezoneOption {
  value: string
  label: string
}

// Quatro fusos do Brasil (§4.6.3, plano etapa 04, "lista IANA curta") -- não a lista
// IANA inteira: o formulário é para organizador brasileiro, não uma busca global de fuso.
export const BRAZIL_TIMEZONES: TimezoneOption[] = [
  { value: 'America/Sao_Paulo', label: 'Brasília' },
  { value: 'America/Manaus', label: 'Manaus' },
  { value: 'America/Rio_Branco', label: 'Rio Branco' },
  { value: 'America/Noronha', label: 'Fernando de Noronha' },
]

export function timezoneLabel(value: string): string {
  return BRAZIL_TIMEZONES.find((tz) => tz.value === value)?.label ?? value
}

// Converte um horário "de parede" (data + hora, sem fuso) no fuso ESCOLHIDO para o
// instante UTC correto. `new Date("2026-08-20T21:00")` assumiria o fuso da MÁQUINA que
// roda o código (do navegador de quem preenche, ou do processo de teste) -- não o fuso
// que o organizador selecionou. É exatamente a armadilha de §4.6.3: usar o fuso errado
// na conversão. `@internationalized/date` (já dependência do projeto, reservada para
// esta etapa) faz essa conversão sem depender do fuso do processo.
export function zonedWallTimeToUtcDate(date: string, time: string, timezone: string): Date {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const [hour, minute] = time.split(':').map(Number) as [number, number]
  const wallTime = new CalendarDateTime(year, month, day, hour, minute)
  return wallTime.toDate(timezone)
}

// Linha de confirmação do passo 2 (§ etapa 04): mesma data/hora nos dois fusos -- o
// escolhido e UTC -- para o erro de fuso ficar visível no preenchimento, não só depois
// de salvar.
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
