import { describe, expect, it } from 'vitest'
import { assertValidationWindow, computeShareExpiresAt, gateWindowCloses } from './date'
import { AppError } from './errors'

const HOUR = 60 * 60 * 1000

describe('gateWindowCloses', () => {
  it('usa endsAt quando presente', () => {
    const startsAt = new Date('2026-08-23T21:00:00Z')
    const endsAt = new Date('2026-08-23T23:30:00Z')
    expect(gateWindowCloses({ startsAt, endsAt })).toEqual(endsAt)
  })

  it('cai para startsAt + 6h quando não há endsAt', () => {
    const startsAt = new Date('2026-08-23T21:00:00Z')
    expect(gateWindowCloses({ startsAt, endsAt: null })).toEqual(new Date(startsAt.getTime() + 6 * HOUR))
  })
})

describe('assertValidationWindow', () => {
  it('lança GATE_TOO_EARLY antes de startsAt - 2h', () => {
    const startsAt = new Date(Date.now() + 3 * HOUR)
    expect(() => assertValidationWindow({ startsAt, endsAt: null })).toThrow(AppError)
    expect(() => assertValidationWindow({ startsAt, endsAt: null })).toThrow(/ainda não abriu/)
  })

  it('passa dentro da janela (startsAt - 2h até startsAt + 6h)', () => {
    const startsAt = new Date(Date.now() - HOUR)
    expect(() => assertValidationWindow({ startsAt, endsAt: null })).not.toThrow()
  })

  it('lança GATE_CLOSED depois do fim da janela', () => {
    const startsAt = new Date(Date.now() - 8 * HOUR)
    expect(() => assertValidationWindow({ startsAt, endsAt: null })).toThrow(/já encerrado/)
  })

  it('2h01 antes de startsAt -- ainda GATE_TOO_EARLY (§ etapa 10)', () => {
    const startsAt = new Date(Date.now() + 2 * HOUR + 60_000)
    expect(() => assertValidationWindow({ startsAt, endsAt: null })).toThrow(/ainda não abriu/)
  })

  it('1h59 antes de startsAt -- já passa (dentro da janela)', () => {
    const startsAt = new Date(Date.now() + 1 * HOUR + 59 * 60_000)
    expect(() => assertValidationWindow({ startsAt, endsAt: null })).not.toThrow()
  })

  it('6h01 depois de startsAt (sem endsAt) -- GATE_CLOSED', () => {
    const startsAt = new Date(Date.now() - 6 * HOUR - 60_000)
    expect(() => assertValidationWindow({ startsAt, endsAt: null })).toThrow(/já encerrado/)
  })

  it('endsAt explícito tem precedência sobre o teto de 6h', () => {
    // endsAt manda mesmo quando cai ANTES do teto de 6h (evento curto)
    const startsAt = new Date(Date.now() - 3 * HOUR)
    const endsAt = new Date(Date.now() - HOUR) // evento já encerrou antes das 6h
    expect(() => assertValidationWindow({ startsAt, endsAt })).toThrow(/já encerrado/)

    // e mesmo quando cai DEPOIS do teto de 6h (evento longo) -- endsAt ainda abre a janela
    const startsAt2 = new Date(Date.now() - 7 * HOUR)
    const endsAt2 = new Date(Date.now() + HOUR) // evento longo, ainda não acabou
    expect(() => assertValidationWindow({ startsAt: startsAt2, endsAt: endsAt2 })).not.toThrow()
  })
})

describe('computeShareExpiresAt', () => {
  it('sem endsAt -- expira em startsAt + 6h', () => {
    const startsAt = new Date('2026-08-23T21:00:00Z')
    expect(computeShareExpiresAt({ startsAt, endsAt: null })).toEqual(new Date(startsAt.getTime() + 6 * HOUR))
  })

  it('endsAt antes de startsAt + 6h -- o mais restritivo (endsAt) vence', () => {
    const startsAt = new Date('2026-08-23T21:00:00Z')
    const endsAt = new Date(startsAt.getTime() + 2 * HOUR) // show curto
    expect(computeShareExpiresAt({ startsAt, endsAt })).toEqual(endsAt)
  })

  it('endsAt depois de startsAt + 6h -- o teto de 6h vence, não o fim do evento', () => {
    const startsAt = new Date('2026-08-23T21:00:00Z')
    const endsAt = new Date(startsAt.getTime() + 10 * HOUR) // evento longo
    expect(computeShareExpiresAt({ startsAt, endsAt })).toEqual(new Date(startsAt.getTime() + 6 * HOUR))
  })
})
