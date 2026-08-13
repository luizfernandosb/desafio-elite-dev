import type { Seatmap, SeatStatus } from './api'

export interface SeatStatePatch {
  seatId: string
  eventId: string
  status: SeatStatus
  expiresAt: string | null
}

// Atualiza só o assento que mudou (§ etapa 07) -- nenhum refetch completo do
// snapshot a cada evento do Realtime. Imutável: retorna um `Seatmap` novo, nunca
// muta o que veio do cache do TanStack Query.
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
