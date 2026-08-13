import type { RealtimeConnectionStatus } from '../useSeatRealtime'
import styles from './ConnectionBadge.module.css'

interface ConnectionBadgeProps {
  status: RealtimeConnectionStatus
}

type BadgeState = 'live' | 'reconnecting' | 'manual'

// Três estados, nunca escondido (§ etapa 07) -- o usuário precisa saber se está
// vendo tempo real. `CONNECTING`/`CHANNEL_ERROR`/`TIMED_OUT` são transitórios (o
// cliente Supabase tenta de novo sozinho) -- "reconectando"; `CLOSED` é o canal
// definitivamente encerrado (efeito de limpeza ou falha que não vai se recuperar
// sozinha) -- "atualização manual", o polling de 5s (etapa 07) é quem sustenta o
// mapa a partir daí.
function toBadgeState(status: RealtimeConnectionStatus): BadgeState {
  if (status === 'SUBSCRIBED') return 'live'
  if (status === 'CLOSED') return 'manual'
  return 'reconnecting'
}

const LABEL: Record<BadgeState, string> = {
  live: 'Ao vivo',
  reconnecting: 'Reconectando…',
  manual: 'Atualização manual',
}

// Sem `role="status"` -- não é o live region que anuncia mudança de assento (essa é
// outra, § etapa 07, alimentada só por mudanças de OUTROS usuários); é só um
// indicador visual persistente, sempre visível, do estado da conexão.
export function ConnectionBadge({ status }: ConnectionBadgeProps) {
  const state = toBadgeState(status)
  return <span className={`${styles.badge} ${styles[state]}`}>{LABEL[state]}</span>
}
