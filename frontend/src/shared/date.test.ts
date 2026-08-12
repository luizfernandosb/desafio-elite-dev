import { describe, expect, it } from 'vitest'
import { formatEventDate, formatRelative } from './date'

describe('formatEventDate', () => {
  it('mesmo instante UTC formatado em fusos diferentes dá horas diferentes (§4.6.3)', () => {
    const instant = '2026-06-15T15:00:00Z'

    const saoPaulo = formatEventDate(instant, 'America/Sao_Paulo')
    const manaus = formatEventDate(instant, 'America/Manaus')

    expect(saoPaulo).toContain('12:00')
    expect(manaus).toContain('11:00')
    expect(saoPaulo).not.toBe(manaus)
  })

  it('aceita Date além de string ISO', () => {
    const instant = new Date('2026-06-15T15:00:00Z')
    expect(formatEventDate(instant, 'America/Sao_Paulo')).toContain('12:00')
  })
})

describe('formatRelative', () => {
  it('conta minutos e segundos restantes', () => {
    const now = new Date('2026-06-15T15:00:00Z')
    const target = new Date('2026-06-15T15:09:30Z') // 9m30s no futuro
    expect(formatRelative(target, now)).toBe('9m 30s')
  })

  it('data no passado -- expirado, não número negativo', () => {
    const now = new Date('2026-06-15T15:10:00Z')
    const target = new Date('2026-06-15T15:00:00Z')
    expect(formatRelative(target, now)).toBe('expirado')
  })

  it('zero -- expirado, não "0m 00s"', () => {
    const now = new Date('2026-06-15T15:00:00Z')
    expect(formatRelative(now, now)).toBe('expirado')
  })
})
