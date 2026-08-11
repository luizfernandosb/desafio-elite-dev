import { randomUUID } from 'node:crypto'
import { SeatKind, SeatStatus } from '../../../generated/prisma/enums'
import { AppError } from '../../shared/errors'

export const MAX_ROWS = 26 // fileira é letra -- A..Z
export const MAX_SEATS_PER_ROW = 40 // teto de 1.040 assentos por evento

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
  return String.fromCharCode(65 + index) // 0 -> 'A', 25 -> 'Z'
}

// gera todo assento do layout, já com id -- Prisma `createMany` não devolve as linhas
// criadas, e o SeatState precisa do mesmo id na mesma transação (etapa 05)
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
  meta: { generatedAt: string; priceInCents: number; currency: string }
}

interface SeatWithState {
  id: string
  row: string
  number: number
  kind: SeatKind
  state: { status: SeatStatus; expiresAt: Date | null } | null
}

// snapshot que o front consome (§4.4.2) -- também o fallback de polling quando o
// Realtime cai (§4.4.5). Trata `expiresAt` vencido como FREE mesmo que a linha ainda
// diga HELD: a granularidade do pg_cron é de 1 min, a leitura não pode herdar esse
// atraso (§4.4.3). Nunca inclui userId -- SeatState não tem essa coluna (§4.4.2).
export function buildSeatmap(
  event: { id: string; priceInCents: number; currency: string },
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
      currency: event.currency,
    },
  }
}
