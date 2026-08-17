import { randomUUID } from 'node:crypto'
import { SeatKind, SeatStatus, type RoomType } from '../../../generated/prisma/enums'
import { AppError } from '../../shared/errors'
import { computeEffectivePriceInCents } from './pricing'

export const MAX_ROWS = 26
export const MAX_SEATS_PER_ROW = 40

export interface SeatLayout {
  rows: number
  seatsPerRow: number
  accessibleSeats?: string[]
}

export interface GeneratedSeat {
  id: string
  row: string
  number: number
  kind: SeatKind
}

function rowLetter(index: number): string {
  return String.fromCharCode(65 + index)
}

export function generateSeats(layout: SeatLayout): GeneratedSeat[] {
  if (layout.rows < 1 || layout.rows > MAX_ROWS) {
    throw new AppError('INVALID_LAYOUT', `rows deve estar entre 1 e ${MAX_ROWS}`)
  }
  if (layout.seatsPerRow < 1 || layout.seatsPerRow > MAX_SEATS_PER_ROW) {
    throw new AppError('INVALID_LAYOUT', `seatsPerRow deve estar entre 1 e ${MAX_SEATS_PER_ROW}`)
  }

  const accessible = new Set(layout.accessibleSeats ?? [])
  const seats: GeneratedSeat[] = []

  for (let rowIndex = 0; rowIndex < layout.rows; rowIndex++) {
    const row = rowLetter(rowIndex)
    for (let number = 1; number <= layout.seatsPerRow; number++) {
      seats.push({
        id: randomUUID(),
        row,
        number,
        kind: accessible.has(`${row}${number}`) ? SeatKind.ACCESSIBLE : SeatKind.REGULAR,
      })
    }
  }

  return seats
}

export function isValidSeatLabel(label: string, layout: { rows: number; seatsPerRow: number }): boolean {
  const match = /^([A-Z])(\d+)$/.exec(label)
  if (!match) return false

  const rowIndex = (match[1] as string).charCodeAt(0) - 65
  const number = Number(match[2])

  return rowIndex >= 0 && rowIndex < layout.rows && number >= 1 && number <= layout.seatsPerRow
}

export interface SeatmapSeat {
  id: string
  number: number
  kind: SeatKind
  status: SeatStatus
}

export interface SeatmapRow {
  row: string
  seats: SeatmapSeat[]
}

export interface Seatmap {
  eventId: string
  rows: SeatmapRow[]
  meta: { generatedAt: string; priceInCents: number; effectivePriceInCents: number; currency: string }
}

interface SeatWithState {
  id: string
  row: string
  number: number
  kind: SeatKind
  state: { status: SeatStatus; expiresAt: Date | null } | null
}

export function buildSeatmap(
  event: {
    id: string
    priceInCents: number
    currency: string
    roomType: RoomType
    vipSurchargePercent: number | null
  },
  seats: SeatWithState[],
): Seatmap {
  const now = Date.now()
  const rows = new Map<string, SeatmapRow>()

  for (const seat of seats) {
    let status = seat.state?.status ?? SeatStatus.FREE
    if (status === SeatStatus.HELD && seat.state?.expiresAt && seat.state.expiresAt.getTime() < now) {
      status = SeatStatus.FREE
    }

    const row = rows.get(seat.row) ?? { row: seat.row, seats: [] }
    row.seats.push({ id: seat.id, number: seat.number, kind: seat.kind, status })
    rows.set(seat.row, row)
  }

  return {
    eventId: event.id,
    rows: [...rows.values()],
    meta: {
      generatedAt: new Date().toISOString(),
      priceInCents: event.priceInCents,
      effectivePriceInCents: computeEffectivePriceInCents(event),
      currency: event.currency,
    },
  }
}
