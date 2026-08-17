import { useMutation } from '@tanstack/react-query'
import { useToast } from '../../components'
import { ApiError } from '../../lib/api'
import { createHold, type SeatHold, type SeatSelection } from './api'
import { holdErrorMessage } from './error-messages'

interface UseHoldOptions {
  eventId: string
  onHoldCreated: (holds: SeatHold[]) => void
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
