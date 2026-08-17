import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components'
import { gateKeys, validateTicket, type GateValidationResponse } from './api'
import { gateValidationErrorMessage } from './error-messages'

export function useGateValidation(eventId: string | null) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [result, setResult] = useState<GateValidationResponse | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: (code: string) => validateTicket(code, eventId as string),
    onSuccess: (response) => {
      setResult(response)
      if (eventId) void queryClient.invalidateQueries({ queryKey: gateKeys.stats(eventId) })
    },
    onError: (err) => {
      showToast(gateValidationErrorMessage(err), 'danger')
    },
  })

  const busy = isPending || result !== null

  function submit(rawCode: string) {
    const code = rawCode.trim()
    if (!eventId || !code || busy) return
    mutate(code)
  }

  function dismiss() {
    setResult(null)
  }

  return { submit, busy, isPending, result, dismiss }
}
