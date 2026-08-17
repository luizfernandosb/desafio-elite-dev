import { Button } from '../../../components'
import { formatMoney } from '../../../shared/money'
import { MAX_SEATS_PER_HOLD, type SeatHold, type TicketPriceType } from '../api'
import { computeSeatPriceInCents } from '../pricing'
import { HoldTimer } from './HoldTimer'
import styles from './SelectionBar.module.css'

export interface SelectedSeatView {
  seatId: string
  label: string
  priceType: TicketPriceType
}

interface SelectionBarProps {
  selectedSeats: SelectedSeatView[]
  effectivePriceInCents: number
  currency: string
  onChangePriceType: (seatId: string, priceType: TicketPriceType) => void
  onReserve: () => void
  isReserving: boolean
  atMax: boolean
  hold: SeatHold[] | null
  onExpire: () => void
  onProceed: () => void
}

export function SelectionBar({
  selectedSeats,
  effectivePriceInCents,
  currency,
  onChangePriceType,
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

  if (selectedSeats.length === 0) return null

  const total = selectedSeats.reduce(
    (sum, seat) => sum + computeSeatPriceInCents(effectivePriceInCents, seat.priceType),
    0,
  )
  const hasHalf = selectedSeats.some((seat) => seat.priceType === 'HALF')

  return (
    <div className={styles.bar} role="region" aria-label="Assentos selecionados">
      <div className={styles.summary}>
        <ul className={styles.seatList}>
          {selectedSeats.map((seat) => (
            <li key={seat.seatId} className={styles.seatRow}>
              <span className={styles.seatLabel}>{seat.label}</span>
              <div className={styles.priceTypeToggle} role="group" aria-label={`Tipo de ingresso - assento ${seat.label}`}>
                <button
                  type="button"
                  aria-pressed={seat.priceType === 'FULL'}
                  className={seat.priceType === 'FULL' ? styles.priceTypeActive : styles.priceTypeOption}
                  onClick={() => onChangePriceType(seat.seatId, 'FULL')}
                >
                  Inteira
                </button>
                <button
                  type="button"
                  aria-pressed={seat.priceType === 'HALF'}
                  className={seat.priceType === 'HALF' ? styles.priceTypeActive : styles.priceTypeOption}
                  onClick={() => onChangePriceType(seat.seatId, 'HALF')}
                >
                  Meia-entrada
                </button>
              </div>
            </li>
          ))}
        </ul>
        {hasHalf && (
          <p role="note" className={styles.halfNotice}>
            Meia-entrada exige apresentação de documento comprobatório (ex.: carteira de estudante, RG) na
            entrada do cinema.
          </p>
        )}
        <p className={styles.total}>{formatMoney(total, currency)}</p>
        {atMax && <p className={styles.maxHint}>Máximo de {MAX_SEATS_PER_HOLD} assentos por reserva.</p>}
      </div>
      <Button onClick={onReserve} loading={isReserving}>
        Reservar por 10 minutos
      </Button>
    </div>
  )
}
