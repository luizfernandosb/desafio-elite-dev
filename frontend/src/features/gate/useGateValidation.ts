import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components'
import { gateKeys, validateTicket, type GateValidationResponse } from './api'
import { gateValidationErrorMessage } from './error-messages'

// Um único `busy` cobre as duas exigências do plano de uma vez: nenhuma segunda
// validação dispara enquanto a primeira está em voo (`isPending`) OU enquanto o
// resultado da anterior ainda ocupa a tela cheia (`result !== null`) -- ambos a
// câmera (debounce de frame repetido) e a digitação manual (botão desabilitado)
// checam o mesmo flag. `result` só volta a `null` via `dismiss`, chamado sozinho
// pelo `ValidationResultScreen` depois de ~2s (a pausa pós-leitura do plano nasce
// daí, sem precisar de um segundo temporizador independente).
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
