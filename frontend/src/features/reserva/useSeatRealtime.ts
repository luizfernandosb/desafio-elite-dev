import { useEffect, useRef, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { SeatStatePatch } from './applySeatPatch'

export type RealtimeConnectionStatus = 'CONNECTING' | 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'

export function useSeatRealtime(eventId: string, onPatch: (patch: SeatStatePatch) => void): RealtimeConnectionStatus {
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>('CONNECTING')
  const onPatchRef = useRef(onPatch)
  onPatchRef.current = onPatch

  useEffect(() => {
    if (!eventId) return

    setConnectionStatus('CONNECTING')

    const channel = supabase
      .channel(`seatmap:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'seat_state', filter: `eventId=eq.${eventId}` },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const row = payload.new as Record<string, unknown>
          if (!row.seatId) return
          onPatchRef.current({
            seatId: row.seatId as string,
            eventId: row.eventId as string,
            status: row.status as SeatStatePatch['status'],
            expiresAt: (row.expiresAt as string | null) ?? null,
          })
        },
      )
      .subscribe((status) => setConnectionStatus(status))

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [eventId])

  return connectionStatus
}
