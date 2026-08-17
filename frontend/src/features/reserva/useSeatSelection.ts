import { useState } from 'react'
import { useToast } from '../../components'
import { MAX_SEATS_PER_HOLD, type SeatSelection, type TicketPriceType } from './api'

export function useSeatSelection() {
  const [selectedSeats, setSelectedSeats] = useState<SeatSelection[]>([])
  const { showToast } = useToast()

  function toggle(seatId: string) {
    setSelectedSeats((prev) => {
      if (prev.some((seat) => seat.seatId === seatId)) return prev.filter((seat) => seat.seatId !== seatId)
      if (prev.length >= MAX_SEATS_PER_HOLD) {
        showToast(`Máximo de ${MAX_SEATS_PER_HOLD} assentos por reserva.`, 'danger')
        return prev
      }
      return [...prev, { seatId, priceType: 'FULL' }]
    })
  }

  function setPriceType(seatId: string, priceType: TicketPriceType) {
    setSelectedSeats((prev) => prev.map((seat) => (seat.seatId === seatId ? { ...seat, priceType } : seat)))
  }

  function clear() {
    setSelectedSeats([])
  }

  function removeMany(seatIds: string[]) {
    setSelectedSeats((prev) => prev.filter((seat) => !seatIds.includes(seat.seatId)))
  }

  const selectedSeatIds = selectedSeats.map((seat) => seat.seatId)

  return {
    selectedSeats,
    selectedSeatIds,
    toggle,
    setPriceType,
    clear,
    removeMany,
    atMax: selectedSeatIds.length >= MAX_SEATS_PER_HOLD,
  }
}
