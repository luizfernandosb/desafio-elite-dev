import type { PublicEvent } from './api'

export interface MovieGroup {
  key: string
  // sessão mais próxima do filme -- representa o filme inteiro no card/carrossel.
  // A listagem que alimenta isto (`GET /events`) já vem ordenada por `startsAt asc`
  // (events.service.ts), então a primeira ocorrência de cada filme já é a sessão
  // mais próxima, sem precisar reordenar aqui.
  primary: PublicEvent
  sessionCount: number
}

function movieKey(event: PublicEvent): string {
  return `${event.source}|${event.externalId}`
}

// Uma sessão só difere de outra do MESMO filme por horário/sala/formato/idioma
// (`Event` é ao mesmo tempo "o filme" e "a sessão", § schema.prisma) -- sem
// agrupar, cada sessão vira seu próprio card, e um filme com 3 sessões aparece 3
// vezes repetido no carrossel/grade. Aqui agrupamos por filme (`source`+
// `externalId`, § api.ts) para o filme aparecer UMA vez; as diferenças entre
// sessões (horário, 2D/3D, dublado/legendado, sala VIP) continuam visíveis ao
// entrar no filme -- `EventDetailPage` já agrupa isso por dia via
// `buildShowtimesByDay` (showtimes.ts).
export function groupEventsByMovie(events: PublicEvent[]): MovieGroup[] {
  const groups = new Map<string, MovieGroup>()
  for (const event of events) {
    const key = movieKey(event)
    const existing = groups.get(key)
    if (existing) existing.sessionCount += 1
    else groups.set(key, { key, primary: event, sessionCount: 1 })
  }
  return Array.from(groups.values())
}
