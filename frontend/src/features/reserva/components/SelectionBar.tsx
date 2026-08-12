import { Button } from '../../../components'
import { formatMoney } from '../../../shared/money'
import { MAX_SEATS_PER_HOLD, type SeatHold } from '../api'
import { HoldTimer } from './HoldTimer'
import styles from './SelectionBar.module.css'

interface SelectionBarProps {
  selectedLabels: string[]
  priceInCents: number
  currency: string
  onReserve: () => void
  isReserving: boolean
  atMax: boolean
  // presente = hold já confirmado pelo servidor (201) -- a barra troca de "escolher"
  // para "cronômetro + ir para pagamento". `expiresAt` é sempre o mesmo em todos os
  // holds de uma mesma chamada (§ seat-hold.service.ts, `attemptHold`), qualquer um
  // dos elementos serve.
  hold: SeatHold[] | null
  onExpire: () => void
  onProceed: () => void
}

export function SelectionBar({
  selectedLabels,
  priceInCents,
  currency,
  onReserve,
  isReserving,
  atMax,
  hold,
  onExpire,
  onProceed,
}: SelectionBarProps) {
  if (hold && hold.length > 0) {
    return (
      <div className={styles.bar} role="region" aria-label="Reserva ativa">
        <HoldTimer expiresAt={hold[0]!.expiresAt} onExpire={onExpire} />
        <Button onClick={onProceed}>Ir para pagamento</Button>
      </div>
    )
  }

  if (selectedLabels.length === 0) return null

  const total = priceInCents * selectedLabels.length

  return (
    <div className={styles.bar} role="region" aria-label="Assentos selecionados">
      <div className={styles.summary}>
        <p className={styles.seats}>{selectedLabels.join(', ')}</p>
        <p className={styles.total}>{formatMoney(total, currency)}</p>
        {atMax && <p className={styles.maxHint}>Máximo de {MAX_SEATS_PER_HOLD} assentos por reserva.</p>}
      </div>
      <Button onClick={onReserve} loading={isReserving}>
        Reservar por 10 minutos
      </Button>
    </div>
  )
}
