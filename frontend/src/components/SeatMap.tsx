import { useRef, type KeyboardEvent } from 'react'
import styles from './SeatMap.module.css'

export type SeatMapSeatStatus = 'FREE' | 'HELD' | 'SOLD'

export interface SeatMapSeat {
  label: string
  accessible?: boolean
  status?: SeatMapSeatStatus
  selected?: boolean
}

export interface SeatMapRow {
  row: string
  seats: SeatMapSeat[]
}

interface SeatMapProps {
  rows: SeatMapRow[]
  onSeatClick?: (label: string) => void
  legend?: boolean
  ariaLabel?: string
  showScreen?: boolean
}

function seatStatusLabel(status: SeatMapSeatStatus): string {
  if (status === 'FREE') return 'disponível'
  if (status === 'HELD') return 'reservado por outro usuário'
  return 'vendido'
}

function seatAriaLabel(seat: SeatMapSeat, isDesignMode: boolean): string {
  const parts = [`Assento ${seat.label}`]
  if (seat.accessible) parts.push('acessível')
  if (isDesignMode) return parts.join(', ')
  if (seat.selected) parts.push('selecionado')
  else if (seat.status) parts.push(seatStatusLabel(seat.status))
  return parts.join(', ')
}

export function SeatMap({
  rows,
  onSeatClick,
  legend = false,
  ariaLabel = 'Mapa de assentos',
  showScreen = false,
}: SeatMapProps) {
  const seatRefs = useRef(new Map<string, HTMLDivElement>())

  function focusSeat(label: string) {
    seatRefs.current.get(label)?.focus()
  }

  function handleArrowNav(event: KeyboardEvent, rowIndex: number, colIndex: number) {
    let targetRow = rowIndex
    let targetCol = colIndex
    if (event.key === 'ArrowUp') targetRow -= 1
    else if (event.key === 'ArrowDown') targetRow += 1
    else if (event.key === 'ArrowLeft') targetCol -= 1
    else if (event.key === 'ArrowRight') targetCol += 1
    else return

    const nextSeat = rows[targetRow]?.seats[targetCol]
    if (!nextSeat) return
    event.preventDefault()
    focusSeat(nextSeat.label)
  }

  return (
    <div className={styles.wrapper}>
      {showScreen && <div className={styles.screen}>Tela</div>}
      <div className={styles.grid} role="grid" aria-label={ariaLabel} aria-rowcount={rows.length}>
        {rows.map((row, rowIndex) => (
          <div className={styles.row} role="row" aria-rowindex={rowIndex + 1} key={row.row}>
            <span className={styles.rowLabel} role="rowheader">
              {row.row}
            </span>
            {row.seats.map((seat, colIndex) => {
              const number = seat.label.slice(row.row.length)
              const isDesignMode = seat.status === undefined
              const hasHandler = Boolean(onSeatClick)
              const interactive = hasHandler && (isDesignMode || seat.status === 'FREE' || Boolean(seat.selected))

              const statusClass = seat.selected
                ? styles.selected
                : seat.status
                  ? styles[seat.status.toLowerCase() as Lowercase<SeatMapSeatStatus>]
                  : undefined
              const classes = [styles.seat, statusClass, seat.accessible && styles.accessible, interactive && styles.clickable]
                .filter(Boolean)
                .join(' ')

              function activate() {
                onSeatClick?.(seat.label)
              }

              return (
                <div
                  key={seat.label}
                  ref={(node) => {
                    if (node) seatRefs.current.set(seat.label, node)
                    else seatRefs.current.delete(seat.label)
                  }}
                  role="gridcell"
                  aria-colindex={colIndex + 1}
                  aria-label={seatAriaLabel(seat, isDesignMode)}
                  aria-pressed={isDesignMode ? (seat.accessible ?? false) : undefined}
                  aria-selected={isDesignMode ? undefined : (seat.selected ?? false)}
                  aria-disabled={!isDesignMode && !interactive ? true : undefined}
                  tabIndex={interactive ? 0 : -1}
                  className={classes}
                  data-seat-id={seat.label}
                  onClick={interactive ? activate : undefined}
                  onKeyDown={(event) => {
                    if (interactive && (event.key === 'Enter' || event.key === ' ')) {
                      if (event.key === ' ') event.preventDefault()
                      activate()
                      return
                    }
                    handleArrowNav(event, rowIndex, colIndex)
                  }}
                >
                  {number}
                </div>
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
            <span className={`${styles.swatch} ${styles.selected}`} aria-hidden="true" /> Selecionado
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
