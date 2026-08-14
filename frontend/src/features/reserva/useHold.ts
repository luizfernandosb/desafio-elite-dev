import { useMutation } from '@tanstack/react-query'
import { useToast } from '../../components'
import { ApiError } from '../../lib/api'
import { createHold, type SeatHold, type SeatSelection } from './api'
import { holdErrorMessage } from './error-messages'

interface UseHoldOptions {
  eventId: string
  // 201 -- quem chama decide o que fazer com os holds (mostrar o cronômetro,
  // navegar ao clicar "Ir para pagamento"...). O hook não navega sozinho: a
  // confirmação otimista já pintou o assento como selecionado no clique (§ etapa 06),
  // a navegação de verdade é decisão de fluxo de quem usa o hook, não deste hook.
  onHoldCreated: (holds: SeatHold[]) => void
  // 409 SEAT_TAKEN -- quem chama ajusta a seleção usando os assentos que o SERVIDOR
  // indicou como já tomados, nunca um "algo deu errado" genérico (§ etapa 06, "é o
  // momento em que o requisito BE-4 se torna visível para um humano").
  onSeatsTaken: (takenSeatIds: string[]) => void
}

export function useHold({ eventId, onHoldCreated, onSeatsTaken }: UseHoldOptions) {
  const { showToast } = useToast()

  const { mutate, isPending, error } = useMutation({
    mutationFn: (seats: SeatSelection[]) => createHold(eventId, seats),
    onSuccess: (result) => onHoldCreated(result.data),
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'SEAT_TAKEN') {
        const taken = err.details?.takenSeatIds
        onSeatsTaken(Array.isArray(taken) ? (taken as string[]) : [])
      }
      showToast(holdErrorMessage(err), 'danger')
    },
  })

  return { hold: mutate, isPending, error }
}
