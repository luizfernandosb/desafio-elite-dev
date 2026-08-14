import { useState } from 'react'
import { useToast } from '../../components'
import { MAX_SEATS_PER_HOLD, type SeatSelection, type TicketPriceType } from './api'

// Estado de seleção do cliente -- puramente local, nenhuma chamada à API até o clique
// em "Reservar" (§ etapa 06, "confirmação vem do 409 ou 201, não do clique"). Extraído
// da página para ser testável isoladamente (teto de 6, toggle, ajuste após SEAT_TAKEN).
// Cada assento carrega seu próprio `priceType` (meia-entrada é decidida por assento,
// nunca por seleção inteira) -- todo assento novo entra como FULL por padrão.
export function useSeatSelection() {
  const [selectedSeats, setSelectedSeats] = useState<SeatSelection[]>([])
  const { showToast } = useToast()

  function toggle(seatId: string) {
    setSelectedSeats((prev) => {
      if (prev.some((seat) => seat.seatId === seatId)) return prev.filter((seat) => seat.seatId !== seatId)
      // teto de 6 assentos por reserva, igual ao back (seat-hold.schema.ts,
      // MAX_SEATS_PER_HOLD) -- mensagem, nunca uma chamada que o servidor rejeitaria
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

  // 409 SEAT_TAKEN -- remove só os assentos que o SERVIDOR indicou como já tomados,
  // preserva o resto da seleção do cliente intacta
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
