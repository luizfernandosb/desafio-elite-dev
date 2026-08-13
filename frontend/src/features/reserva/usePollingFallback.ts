import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { reservaKeys } from './api'
import type { RealtimeConnectionStatus } from './useSeatRealtime'

const POLL_INTERVAL_MS = 5000

// O fluxo nunca quebra por causa do tempo real (§4.4.5, § etapa 07) -- sempre que o
// canal não está `SUBSCRIBED` (ainda conectando, erro, timeout ou fechado), um
// polling de 5s assume a atualização do mapa. Ao reconectar, uma revalidação
// completa ANTES de voltar a confiar em patches incrementais -- o Realtime não faz
// replay do que passou durante a queda.
export function usePollingFallback(connectionStatus: RealtimeConnectionStatus, eventId: string): void {
  const queryClient = useQueryClient()
  const wasDisconnected = useRef(false)

  useEffect(() => {
    if (connectionStatus === 'SUBSCRIBED') {
      if (wasDisconnected.current) {
        void queryClient.invalidateQueries({ queryKey: reservaKeys.seatmap(eventId) })
      }
      wasDisconnected.current = false
      return
    }

    wasDisconnected.current = true
    const interval = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: reservaKeys.seatmap(eventId) })
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [connectionStatus, eventId, queryClient])
}
