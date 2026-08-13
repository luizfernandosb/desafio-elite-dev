import { useEffect, useRef, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { SeatStatePatch } from './applySeatPatch'

// LEITURA, nunca escrita (§4.4.2, § etapa 07) -- este arquivo (e nenhum outro do
// front) chama um método de escrita do cliente Supabase em cima de "seat_state".
// Toda escrita de assento passa pela API (POST /holds, etapas 05-08); é a tentação
// natural de quem já tem o cliente Supabase disponível no bundle. Ver
// `supabase-write-contract.test.ts`, que varre `src/` inteiro por esse padrão.

// A união do próprio Supabase (`REALTIME_SUBSCRIBE_STATES`) não tem um estado
// inicial "ainda conectando" -- é só o valor deste hook antes do primeiro callback
// de `.subscribe()` chegar.
export type RealtimeConnectionStatus = 'CONNECTING' | 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'

export function useSeatRealtime(eventId: string, onPatch: (patch: SeatStatePatch) => void): RealtimeConnectionStatus {
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>('CONNECTING')
  // `onPatch` muda a cada render da página (fecha sobre `seatmap`/`selection`
  // atuais) -- guardado em ref para o efeito de assinatura não precisar
  // reinscrever o canal a cada patch aplicado.
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
          // DELETE nunca acontece em `seat_state` de verdade (linha existe desde a
          // criação do evento, só o `status` muda) -- guarda mesmo assim, porque o
          // tipo da união inclui `{}` para esse caso (`payload.new` vazio)
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
