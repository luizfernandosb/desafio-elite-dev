import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { reservaKeys } from './api'
import type { RealtimeConnectionStatus } from './useSeatRealtime'

const POLL_INTERVAL_MS = 5000

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
