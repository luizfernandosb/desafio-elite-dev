import { useRef, useState } from 'react'
import type { SeatStatus } from './api'

const AGGREGATION_WINDOW_MS = 800

export interface AnnouncedSeat {
  seatId: string
  label: string
  status: SeatStatus
}

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
    if (timerRef.current) return

    timerRef.current = setTimeout(() => {
      const batch = bufferRef.current
      bufferRef.current = []
      timerRef.current = null
      setAnnouncement(buildMessage(batch))
    }, AGGREGATION_WINDOW_MS)
  }

  return { announcement, announce }
}
