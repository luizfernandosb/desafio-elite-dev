import type { Seatmap, SeatStatus } from './api'

export interface SeatStatePatch {
  seatId: string
  eventId: string
  status: SeatStatus
  expiresAt: string | null
}

export function applySeatPatch(seatmap: Seatmap, patch: SeatStatePatch): Seatmap {
  let changed = false
  const rows = seatmap.rows.map((row) => {
    const seatIndex = row.seats.findIndex((seat) => seat.id === patch.seatId)
    if (seatIndex === -1) return row

    changed = true
    const seats = row.seats.slice()
    seats[seatIndex] = { ...seats[seatIndex]!, status: patch.status }
    return { ...row, seats }
  })

  return changed ? { ...seatmap, rows } : seatmap
}
