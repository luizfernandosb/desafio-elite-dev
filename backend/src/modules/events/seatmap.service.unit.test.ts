import { describe, expect, it } from 'vitest'
import { SeatKind, SeatStatus } from '../../../generated/prisma/enums'
import { AppError } from '../../shared/errors'
import { buildSeatmap, generateSeats, isValidSeatLabel } from './seatmap.service'

describe('generateSeats', () => {
  it('8x12 gera 96 assentos, de A1 a H12', () => {
    const seats = generateSeats({ rows: 8, seatsPerRow: 12 })

    expect(seats).toHaveLength(96)
    expect(seats[0]).toMatchObject({ row: 'A', number: 1, kind: SeatKind.REGULAR })
    expect(seats.at(-1)).toMatchObject({ row: 'H', number: 12, kind: SeatKind.REGULAR })
    expect(new Set(seats.map((s) => s.id)).size).toBe(96) // ids únicos
  })

  it('accessibleSeats marca o kind ACCESSIBLE só nos assentos listados', () => {
    const seats = generateSeats({ rows: 2, seatsPerRow: 3, accessibleSeats: ['A1', 'B3'] })

    const byLabel = new Map(seats.map((s) => [`${s.row}${s.number}`, s.kind]))
    expect(byLabel.get('A1')).toBe(SeatKind.ACCESSIBLE)
    expect(byLabel.get('B3')).toBe(SeatKind.ACCESSIBLE)
    expect(byLabel.get('A2')).toBe(SeatKind.REGULAR)
    expect(byLabel.get('B1')).toBe(SeatKind.REGULAR)
  })

  it('rows: 27 é rejeitado', () => {
    expect(() => generateSeats({ rows: 27, seatsPerRow: 10 })).toThrow(AppError)
  })

  it('seatsPerRow: 41 é rejeitado', () => {
    expect(() => generateSeats({ rows: 10, seatsPerRow: 41 })).toThrow(AppError)
  })
})

describe('isValidSeatLabel', () => {
  const layout = { rows: 8, seatsPerRow: 12 }

  it('aceita um rótulo dentro do layout', () => {
    expect(isValidSeatLabel('A1', layout)).toBe(true)
    expect(isValidSeatLabel('H12', layout)).toBe(true)
  })

  it('rejeita fileira ou número fora do layout', () => {
    expect(isValidSeatLabel('I1', layout)).toBe(false)
    expect(isValidSeatLabel('A13', layout)).toBe(false)
    expect(isValidSeatLabel('a1', layout)).toBe(false)
    expect(isValidSeatLabel('A0', layout)).toBe(false)
  })
})

describe('buildSeatmap', () => {
  const event = { id: 'event-1', priceInCents: 3200, currency: 'BRL' }

  it('agrupa assentos por fileira, na ordem recebida', () => {
    const seatmap = buildSeatmap(event, [
      { id: 's1', row: 'A', number: 1, kind: SeatKind.REGULAR, state: { status: SeatStatus.FREE, expiresAt: null } },
      { id: 's2', row: 'A', number: 2, kind: SeatKind.REGULAR, state: { status: SeatStatus.SOLD, expiresAt: null } },
      { id: 's3', row: 'B', number: 1, kind: SeatKind.ACCESSIBLE, state: { status: SeatStatus.FREE, expiresAt: null } },
    ])

    expect(seatmap.eventId).toBe('event-1')
    expect(seatmap.rows).toEqual([
      { row: 'A', seats: [{ id: 's1', number: 1, kind: SeatKind.REGULAR, status: SeatStatus.FREE },
                           { id: 's2', number: 2, kind: SeatKind.REGULAR, status: SeatStatus.SOLD }] },
      { row: 'B', seats: [{ id: 's3', number: 1, kind: SeatKind.ACCESSIBLE, status: SeatStatus.FREE }] },
    ])
    expect(seatmap.meta).toMatchObject({ priceInCents: 3200, currency: 'BRL' })
  })

  it('trata HELD com expiresAt vencido como FREE (§4.4.3)', () => {
    const seatmap = buildSeatmap(event, [
      {
        id: 's1',
        row: 'A',
        number: 1,
        kind: SeatKind.REGULAR,
        state: { status: SeatStatus.HELD, expiresAt: new Date(Date.now() - 60_000) },
      },
    ])

    expect(seatmap.rows[0]?.seats[0]?.status).toBe(SeatStatus.FREE)
  })

  it('HELD com expiresAt no futuro continua HELD', () => {
    const seatmap = buildSeatmap(event, [
      {
        id: 's1',
        row: 'A',
        number: 1,
        kind: SeatKind.REGULAR,
        state: { status: SeatStatus.HELD, expiresAt: new Date(Date.now() + 60_000) },
      },
    ])

    expect(seatmap.rows[0]?.seats[0]?.status).toBe(SeatStatus.HELD)
  })

  it('assento sem SeatState (não deveria acontecer) cai para FREE, nunca quebra', () => {
    const seatmap = buildSeatmap(event, [
      { id: 's1', row: 'A', number: 1, kind: SeatKind.REGULAR, state: null },
    ])
    expect(seatmap.rows[0]?.seats[0]?.status).toBe(SeatStatus.FREE)
  })

  it('nunca inclui userId -- SeatState não tem essa coluna', () => {
    const seatmap = buildSeatmap(event, [
      { id: 's1', row: 'A', number: 1, kind: SeatKind.REGULAR, state: { status: SeatStatus.FREE, expiresAt: null } },
    ])
    expect(JSON.stringify(seatmap)).not.toContain('userId')
  })
})
