import { useRef, useState } from 'react'
import type { SeatStatus } from './api'

// Debounce de anúncios (§ etapa 07) -- "5 assentos mudam no mesmo segundo" vira UM
// anúncio agregado, não cinco falas em sequência (tão hostil quanto silêncio total).
const AGGREGATION_WINDOW_MS = 800

export interface AnnouncedSeat {
  seatId: string
  label: string
  status: SeatStatus
}

// `seat_state` não tem `userId` (README, "quem reservou é dado de outra pessoa") --
// a única forma de saber "essa mudança fui eu" é comparar com o que a PRÓPRIA sessão
// já sabe que selecionou/segura (`selection.selectedSeatIds` + `hold`). Mudança do
// próprio usuário nunca é anunciada aqui: já foi anunciada pelo clique/seleção em si
// (§ etapa 07, "anunciar duas vezes a mesma ação é ruído").
export function isOwnSeatChange(seatId: string, ownSeatIds: readonly string[]): boolean {
  return ownSeatIds.includes(seatId)
}

function statusVerb(status: SeatStatus, plural: boolean): string {
  if (status === 'FREE') return plural ? 'liberados' : 'liberado'
  if (status === 'HELD') return plural ? 'reservados' : 'reservado'
  return plural ? 'vendidos' : 'vendido'
}

function buildMessage(batch: AnnouncedSeat[]): string {
  if (batch.length === 1) {
    const seat = batch[0]!
    return `Assento ${seat.label} foi ${statusVerb(seat.status, false)}`
  }

  const firstStatus = batch[0]!.status
  const allSameStatus = batch.every((seat) => seat.status === firstStatus)
  if (allSameStatus) return `${batch.length} assentos foram ${statusVerb(firstStatus, true)}`

  return `${batch.length} assentos mudaram de status`
}

export function useLiveAnnouncements() {
  const [announcement, setAnnouncement] = useState('')
  const bufferRef = useRef<AnnouncedSeat[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function announce(seat: AnnouncedSeat) {
    bufferRef.current.push(seat)
    if (timerRef.current) return // já tem um flush agendado -- só acumula no buffer

    timerRef.current = setTimeout(() => {
      const batch = bufferRef.current
      bufferRef.current = []
      timerRef.current = null
      setAnnouncement(buildMessage(batch))
    }, AGGREGATION_WINDOW_MS)
  }

  return { announcement, announce }
}
