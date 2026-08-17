import type { RealtimeConnectionStatus } from '../useSeatRealtime'
import styles from './ConnectionBadge.module.css'

interface ConnectionBadgeProps {
  status: RealtimeConnectionStatus
}

type BadgeState = 'live' | 'reconnecting' | 'manual'

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

export function ConnectionBadge({ status }: ConnectionBadgeProps) {
  const state = toBadgeState(status)
  return <span className={`${styles.badge} ${styles[state]}`}>{LABEL[state]}</span>
}
