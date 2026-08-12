import { useState } from 'react'
import { useToast } from '../../components'
import { MAX_SEATS_PER_HOLD } from './api'

// Estado de seleção do cliente -- puramente local, nenhuma chamada à API até o clique
// em "Reservar" (§ etapa 06, "confirmação vem do 409 ou 201, não do clique"). Extraído
// da página para ser testável isoladamente (teto de 6, toggle, ajuste após SEAT_TAKEN).
export function useSeatSelection() {
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([])
  const { showToast } = useToast()

  function toggle(seatId: string) {
    setSelectedSeatIds((prev) => {
      if (prev.includes(seatId)) return prev.filter((id) => id !== seatId)
      // teto de 6 assentos por reserva, igual ao back (seat-hold.schema.ts,
      // MAX_SEATS_PER_HOLD) -- mensagem, nunca uma chamada que o servidor rejeitaria
      if (prev.length >= MAX_SEATS_PER_HOLD) {
        showToast(`Máximo de ${MAX_SEATS_PER_HOLD} assentos por reserva.`, 'danger')
        return prev
      }
      return [...prev, seatId]
    })
  }

  function clear() {
    setSelectedSeatIds([])
  }

  // 409 SEAT_TAKEN -- remove só os assentos que o SERVIDOR indicou como já tomados,
  // preserva o resto da seleção do cliente intacta
  function removeMany(seatIds: string[]) {
    setSelectedSeatIds((prev) => prev.filter((id) => !seatIds.includes(id)))
  }

  return {
    selectedSeatIds,
    toggle,
    clear,
    removeMany,
    atMax: selectedSeatIds.length >= MAX_SEATS_PER_HOLD,
  }
}
