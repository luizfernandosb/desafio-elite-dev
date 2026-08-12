import styles from './SeatMap.module.css'

export type SeatMapSeatStatus = 'FREE' | 'HELD' | 'SOLD'

export interface SeatMapSeat {
  label: string // "A12" -- fileira + número, mesmo formato do back (§ seatmap.service.ts)
  accessible?: boolean
  // ausente = modo de projeto (assistente de criação, etapa 04): não existe ocupação
  // real ainda, só o desenho da sala. Presente = leitura de um evento de verdade.
  status?: SeatMapSeatStatus
}

export interface SeatMapRow {
  row: string
  seats: SeatMapSeat[]
}

interface SeatMapProps {
  rows: SeatMapRow[]
  // presente = modo de projeto (clique marca/desmarca acessível). Ausente = leitura
  // (gestão da sessão, e futuramente o mapa de reserva da etapa 06) -- mesmo
  // componente, dois usos, para nunca haver duas verdades sobre o desenho da sala.
  onSeatClick?: (label: string) => void
  legend?: boolean
}

function seatStatusLabel(status: SeatMapSeatStatus): string {
  if (status === 'FREE') return 'livre'
  if (status === 'HELD') return 'reservado'
  return 'vendido'
}

export function SeatMap({ rows, onSeatClick, legend = false }: SeatMapProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.grid} role="grid" aria-label="Mapa de assentos">
        {rows.map((row) => (
          <div className={styles.row} role="row" key={row.row}>
            <span className={styles.rowLabel} aria-hidden="true">
              {row.row}
            </span>
            {row.seats.map((seat) => {
              const number = seat.label.slice(row.row.length)
              const statusClass = seat.status ? styles[seat.status.toLowerCase() as Lowercase<SeatMapSeatStatus>] : undefined
              const classes = [styles.seat, statusClass, seat.accessible && styles.accessible, onSeatClick && styles.clickable]
                .filter(Boolean)
                .join(' ')
              const label = `Assento ${seat.label}${seat.accessible ? ', acessível' : ''}${
                seat.status ? `, ${seatStatusLabel(seat.status)}` : ''
              }`

              return (
                <button
                  key={seat.label}
                  type="button"
                  role="gridcell"
                  className={classes}
                  disabled={!onSeatClick}
                  aria-label={label}
                  aria-pressed={onSeatClick ? seat.accessible ?? false : undefined}
                  onClick={onSeatClick ? () => onSeatClick(seat.label) : undefined}
                >
                  {number}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      {legend && (
        <ul className={styles.legend}>
          <li>
            <span className={`${styles.swatch} ${styles.free}`} aria-hidden="true" /> Livre
          </li>
          <li>
            <span className={`${styles.swatch} ${styles.held}`} aria-hidden="true" /> Reservado
          </li>
          <li>
            <span className={`${styles.swatch} ${styles.sold}`} aria-hidden="true" /> Vendido
          </li>
          <li>
            <span className={`${styles.swatch} ${styles.accessible}`} aria-hidden="true" /> Acessível
          </li>
        </ul>
      )}
    </div>
  )
}
