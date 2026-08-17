import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Badge, ErrorState, Skeleton } from '../../../components'
import { formatEventDate } from '../../../shared/date'
import { sessionAttributeBadges } from '../../../shared/session-attributes'
import { ticketPriceTypeLabel } from '../../../shared/ticket-price-type'
import { getTicket, ticketKeys } from '../api'
import { CancelTicketButton } from '../components/CancelTicketButton'
import { ShareButton } from '../components/ShareButton'
import { ticketStatusLabel, ticketStatusVariant } from '../status'
import styles from './TicketDetailPage.module.css'

const QR_SIZE = 220

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const ticketId = id ?? ''

  const {
    data: ticket,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ticketKeys.detail(ticketId),
    queryFn: () => getTicket(ticketId),
    enabled: Boolean(ticketId),
  })

  if (isLoading) {
    return (
      <div className={styles.page}>
        <Skeleton height="28px" width="60%" />
        <Skeleton height="280px" radius="md" />
      </div>
    )
  }

  if (isError || !ticket) {
    return (
      <div className={styles.page}>
        <ErrorState error={error} onRetry={() => refetch()} />
        <Link to="/ingressos">Voltar para meus ingressos</Link>
      </div>
    )
  }

  const { event, seat, status, code, usedAt, priceType } = ticket

  return (
    <div className={styles.page}>
      <Link to="/ingressos" className={styles.back}>
        ← Meus ingressos
      </Link>

      <div className={styles.header}>
        <h1>{event.title}</h1>
        <Badge variant={ticketStatusVariant(status)}>{ticketStatusLabel(status)}</Badge>
      </div>

      <p className={styles.meta}>{formatEventDate(event.startsAt, event.timezone)}</p>
      <p className={styles.meta}>
        {event.venueName} - {event.venueCity}
      </p>
      <div className={styles.badges}>
        {priceType === 'HALF' && <Badge variant="warning">{ticketPriceTypeLabel(priceType)}</Badge>}
        {sessionAttributeBadges(event).map((label) => (
          <Badge key={label}>{label}</Badge>
        ))}
      </div>
      <p className={styles.seat}>
        {seat ? `Fileira ${seat.row}, assento ${seat.number}` : 'Assento não atribuído'}
      </p>
      {priceType === 'HALF' && (
        <p className={styles.meta}>
          Meia-entrada: apresente documento comprobatório (ex.: carteira de estudante, RG) na entrada.
        </p>
      )}

      {status === 'CANCELLED' ? (
        <p className={styles.cancelledNotice}>Este ingresso foi cancelado. O valor pago foi estornado.</p>
      ) : (
        <div className={styles.qrSection}>
          <div className={styles.qrWrapper}>
            <div className={status === 'USED' ? styles.qrDimmed : undefined}>
              <QRCodeSVG value={code} size={QR_SIZE} bgColor="#ffffff" fgColor="#000000" />
            </div>
            {status === 'USED' && (
              <div className={styles.usedStamp}>
                Já utilizado{usedAt ? ` em ${formatEventDate(usedAt, event.timezone)}` : ''}
              </div>
            )}
          </div>

          <p className={styles.codeLabel}>Código (caso a leitura do QR falhe)</p>
          <code className={styles.code}>{code}</code>

          <p className={styles.hint}>
            Dica: aumente o brilho da tela para facilitar a leitura na portaria em ambientes escuros.
          </p>

          <ShareButton ticketId={ticket.id} />

          {status === 'ACTIVE' && new Date(event.startsAt).getTime() > Date.now() && (
            <CancelTicketButton ticket={ticket} />
          )}
        </div>
      )}
    </div>
  )
}
