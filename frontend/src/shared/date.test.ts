import { describe, expect, it } from 'vitest'
import { dayTabLabel, formatEventDate, formatEventTime, formatRelative, toEventDateKey } from './date'

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

describe('toEventDateKey', () => {
  it('mesmo instante UTC pode cair em dias diferentes conforme o fuso', () => {
    const instant = '2026-06-15T02:30:00Z'
    expect(toEventDateKey(instant, 'America/Sao_Paulo')).toBe('2026-06-14')
    expect(toEventDateKey(instant, 'UTC')).toBe('2026-06-15')
  })
})

describe('formatEventTime', () => {
  it('só o horário, no fuso do evento', () => {
    expect(formatEventTime('2026-06-15T15:00:00Z', 'America/Sao_Paulo')).toBe('12:00')
  })
})

describe('dayTabLabel', () => {
  const now = new Date('2026-08-13T12:00:00Z')

  it('hoje -- rótulo "Hoje", não o dia da semana', () => {
    expect(dayTabLabel('2026-08-13', 'America/Sao_Paulo', now)).toEqual({ label: 'Hoje', shortDate: '13/08' })
  })

  it('amanhã -- rótulo "Amanhã"', () => {
    expect(dayTabLabel('2026-08-14', 'America/Sao_Paulo', now)).toEqual({ label: 'Amanhã', shortDate: '14/08' })
  })

  it('demais dias -- abreviação do dia da semana', () => {
    expect(dayTabLabel('2026-08-15', 'America/Sao_Paulo', now)).toEqual({ label: 'SÁB', shortDate: '15/08' })
    expect(dayTabLabel('2026-08-16', 'America/Sao_Paulo', now)).toEqual({ label: 'DOM', shortDate: '16/08' })
  })
})

describe('formatRelative', () => {
  it('conta minutos e segundos restantes', () => {
    const now = new Date('2026-06-15T15:00:00Z')
    const target = new Date('2026-06-15T15:09:30Z')
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
