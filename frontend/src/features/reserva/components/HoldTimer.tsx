import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './HoldTimer.module.css'

interface HoldTimerProps {
  expiresAt: string // ISO, do servidor -- nunca do momento em que este componente monta
  onExpire: () => void
}

const WARNING_THRESHOLD_MS = 2 * 60 * 1000

function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Cronômetro recalculado a cada 1s a PARTIR de `expiresAt` (§ etapa 06) -- nunca uma
// contagem própria a partir do momento de montagem: o relógio do cliente pode estar
// errado ou a aba pode ter ficado em segundo plano, e o servidor é a única fonte de
// verdade sobre quando o hold expira de fato.
export function HoldTimer({ expiresAt, onExpire }: HoldTimerProps) {
  const expiresAtMs = useMemo(() => new Date(expiresAt).getTime(), [expiresAt])
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, expiresAtMs - Date.now()))
  const [announcement, setAnnouncement] = useState('')
  const announcedRef = useRef(new Set<'5min' | '1min'>())

  useEffect(() => {
    const tick = () => setRemainingMs(Math.max(0, expiresAtMs - Date.now()))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [expiresAtMs])

  useEffect(() => {
    if (remainingMs <= 0) {
      onExpire()
    }
  }, [remainingMs, onExpire])

  const totalSeconds = Math.ceil(remainingMs / 1000)

  // marcos anunciados uma vez cada (§ etapa 06, "spam de leitor de tela é tão hostil
  // quanto silêncio total") -- efeito, não mutação durante o render: em StrictMode
  // (main.tsx) o corpo do componente roda duas vezes por commit, e mutar o Set ali
  // marcaria "já anunciado" antes do usuário de fato ouvir o aviso.
  useEffect(() => {
    if (totalSeconds === 300 && !announcedRef.current.has('5min')) {
      announcedRef.current.add('5min')
      setAnnouncement('5 minutos restantes')
    } else if (totalSeconds === 60 && !announcedRef.current.has('1min')) {
      announcedRef.current.add('1min')
      setAnnouncement('1 minuto restante')
    }
  }, [totalSeconds])

  const isWarning = remainingMs > 0 && remainingMs <= WARNING_THRESHOLD_MS

  return (
    <div className={styles.wrapper}>
      <span className={`${styles.timer} ${isWarning ? styles.warning : ''}`}>{formatRemaining(remainingMs)}</span>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}
