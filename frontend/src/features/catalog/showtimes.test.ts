import { describe, expect, it } from 'vitest'
import type { PublicEvent } from './api'
import { buildShowtimesByDay, defaultDayTabKey } from './showtimes'

const TIMEZONE = 'America/Sao_Paulo'
const NOW = new Date('2026-08-13T15:00:00Z') // 12:00 em São Paulo (UTC-3)

function makeSession(overrides: Partial<PublicEvent> = {}): PublicEvent {
  return {
    id: 'evt-1',
    source: 'TMDB',
    externalId: '603',
    title: 'Matrix Reloaded',
    genres: [],
    venueName: 'Jardim Norte 05',
    venueCity: 'São Paulo',
    format: 'TWO_D',
    audio: 'DUBBED',
    roomType: 'STANDARD',
    status: 'PUBLISHED',
    startsAt: '2026-08-14T21:00:00Z', // 18:00 em São Paulo, dia 14 (amanhã)
    timezone: TIMEZONE,
    priceInCents: 3200,
    effectivePriceInCents: 3200,
    currency: 'BRL',
    organizer: { id: 'org-1', name: 'Ana' },
    _count: { tickets: 0 },
    ...overrides,
  }
}

describe('buildShowtimesByDay', () => {
  it('sempre inclui a aba de HOJE, mesmo sem nenhuma sessão nesse dia', () => {
    const { dayTabs, groupsByDay } = buildShowtimesByDay([makeSession()], TIMEZONE, NOW)

    expect(dayTabs[0]).toMatchObject({ key: '2026-08-13', label: 'Hoje' })
    expect(groupsByDay.get('2026-08-13')).toEqual([])
  })

  it('sessão passada nunca aparece em nenhuma aba', () => {
    const past = makeSession({ id: 'evt-past', startsAt: '2026-08-13T10:00:00Z' }) // já passou (12:00 é "agora")
    const { dayTabs, groupsByDay } = buildShowtimesByDay([past], TIMEZONE, NOW)

    expect(dayTabs.map((tab) => tab.key)).toEqual(['2026-08-13'])
    expect(groupsByDay.get('2026-08-13')).toEqual([])
  })

  it('agrupa por áudio+formato+sala -- "Dublado - 2D" e "Legendado - 2D" ficam em grupos separados', () => {
    const dubbed = makeSession({ id: 'evt-1', audio: 'DUBBED', startsAt: '2026-08-14T21:00:00Z' })
    const subtitled = makeSession({ id: 'evt-2', audio: 'SUBTITLED', startsAt: '2026-08-14T20:30:00Z' })
    const { groupsByDay } = buildShowtimesByDay([dubbed, subtitled], TIMEZONE, NOW)

    const groups = groupsByDay.get('2026-08-14')!
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ label: 'Dublado - 2D' })
    expect(groups[1]).toMatchObject({ label: 'Legendado - 2D' })
  })

  it('sala VIP entra no rótulo e não se mistura com sala padrão do mesmo áudio/formato', () => {
    const standard = makeSession({ id: 'evt-1', roomType: 'STANDARD' })
    const vip = makeSession({ id: 'evt-2', roomType: 'VIP', effectivePriceInCents: 3840 })
    const { groupsByDay } = buildShowtimesByDay([standard, vip], TIMEZONE, NOW)

    const groups = groupsByDay.get('2026-08-14')!
    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.label)).toEqual(['Dublado - 2D', 'Dublado - 2D - Sala VIP'])
  })

  it('duas sessões no mesmo grupo (mesmo áudio/formato/sala) ficam juntas, ordenadas por horário', () => {
    const later = makeSession({ id: 'evt-later', startsAt: '2026-08-14T23:00:00Z' })
    const earlier = makeSession({ id: 'evt-earlier', startsAt: '2026-08-14T20:00:00Z' })
    const { groupsByDay } = buildShowtimesByDay([later, earlier], TIMEZONE, NOW)

    const groups = groupsByDay.get('2026-08-14')!
    expect(groups).toHaveLength(1)
    expect(groups[0]!.sessions.map((session) => session.id)).toEqual(['evt-earlier', 'evt-later'])
  })

  it('dia sem nenhuma sessão só aparece quando é HOJE -- outro dia vazio nem vira aba', () => {
    const { dayTabs } = buildShowtimesByDay([makeSession({ startsAt: '2026-08-20T21:00:00Z' })], TIMEZONE, NOW)

    // só HOJE e o dia com sessão (20/08) -- nada nos dias vazios no meio
    expect(dayTabs.map((tab) => tab.key)).toEqual(['2026-08-13', '2026-08-20'])
  })
})

describe('defaultDayTabKey', () => {
  it('prefere o dia da sessão originalmente aberta, se ainda estiver nas abas', () => {
    const { dayTabs, groupsByDay } = buildShowtimesByDay([makeSession()], TIMEZONE, NOW)
    expect(defaultDayTabKey(dayTabs, groupsByDay, '2026-08-14')).toBe('2026-08-14')
  })

  it('cai pra primeira aba COM sessão se a preferida não existir mais', () => {
    const { dayTabs, groupsByDay } = buildShowtimesByDay([makeSession()], TIMEZONE, NOW)
    expect(defaultDayTabKey(dayTabs, groupsByDay, '2099-01-01')).toBe('2026-08-14')
  })

  it('sem nenhuma sessão em lugar nenhum, cai pra primeira aba mesmo vazia', () => {
    const { dayTabs, groupsByDay } = buildShowtimesByDay([], TIMEZONE, NOW)
    expect(defaultDayTabKey(dayTabs, groupsByDay)).toBe('2026-08-13')
  })
})
