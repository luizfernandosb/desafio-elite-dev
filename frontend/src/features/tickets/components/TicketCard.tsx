import { Link } from 'react-router-dom'
import { Badge, Card } from '../../../components'
import { formatEventDate } from '../../../shared/date'
import type { Ticket } from '../api'
import { ticketStatusLabel, ticketStatusVariant } from '../status'
import styles from './TicketCard.module.css'

interface TicketCardProps {
  ticket: Ticket
}

export function TicketCard({ ticket }: TicketCardProps) {
  const { event, seat, status } = ticket

  return (
    <Link to={`/ingressos/${ticket.id}`} className={styles.link}>
      <Card interactive className={styles.card}>
        {event.imageUrl ? (
          <img src={event.imageUrl} alt="" loading="lazy" className={styles.poster} />
        ) : (
          <div className={styles.posterFallback} aria-hidden="true" />
        )}
        <div className={styles.info}>
          <div className={styles.header}>
            <h3 className={styles.title}>{event.title}</h3>
            <Badge variant={ticketStatusVariant(status)}>{ticketStatusLabel(status)}</Badge>
          </div>
          <p className={styles.meta}>{formatEventDate(event.startsAt, event.timezone)}</p>
          <p className={styles.meta}>
            {event.venueName} -- {event.venueCity}
          </p>
          {/* `seat` é opcional no tipo (schema: `seatId String?`, "sempre preenchido
              nesta versão SEATED-only") -- fallback nunca deveria aparecer hoje, mas
              o componente não presume um campo que o próprio back marca como opcional */}
          <p className={styles.seat}>
            {seat ? `Fileira ${seat.row}, assento ${seat.number}` : 'Assento não atribuído'}
          </p>
        </div>
      </Card>
    </Link>
  )
}
