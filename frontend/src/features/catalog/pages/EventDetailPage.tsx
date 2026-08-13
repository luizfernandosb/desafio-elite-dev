import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Badge, ErrorState, Skeleton } from '../../../components'
import { useAuth } from '../../auth/useAuth'
import { formatEventDate } from '../../../shared/date'
import { formatMoney } from '../../../shared/money'
import { sessionAttributeBadges } from '../../../shared/session-attributes'
import { catalogKeys, getPublicEvent, getPublicEventSeatmap } from '../api'
import styles from './EventDetailPage.module.css'

function totalSeats(seatmap: { rows: { seats: unknown[] }[] } | undefined): number | null {
  if (!seatmap) return null
  return seatmap.rows.reduce((sum, row) => sum + row.seats.length, 0)
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const eventId = id ?? ''
  const { status: authStatus } = useAuth()

  const {
    data: event,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: catalogKeys.detail(eventId),
    queryFn: () => getPublicEvent(eventId),
    enabled: Boolean(eventId),
  })

  const { data: seatmap } = useQuery({
    queryKey: catalogKeys.seatmap(eventId),
    queryFn: () => getPublicEventSeatmap(eventId),
    enabled: Boolean(event),
  })

  if (isLoading) {
    return (
      <div className={styles.page}>
        <Skeleton height="360px" radius="md" />
        <Skeleton height="32px" width="60%" />
        <Skeleton height="20px" width="40%" />
      </div>
    )
  }

  // `ErrorState` distingue sozinho NOT_FOUND (sem retry, mensagem do back) de um
  // erro de infraestrutura (rede/500/timeout, com retry) -- §5.5.4/§ etapa 11, em
  // vez de um `EmptyState` com título fixo "Sessão não encontrada" independente da
  // causa real.
  if (isError || !event) {
    return (
      <div className={styles.page}>
        <ErrorState error={error} onRetry={() => refetch()} />
        <Link to="/">Voltar para o catálogo</Link>
      </div>
    )
  }

  const capacity = totalSeats(seatmap)
  const sold = event._count.tickets
  const isPast = new Date(event.startsAt).getTime() <= Date.now()
  const isCancelled = event.status === 'CANCELLED'

  const seatsPath = `/eventos/${event.id}/assentos`
  // conta com login só na hora de reservar, nunca para só ver o evento (§ etapa 05,
  // "decidir aqui, não improvisar") -- decidido no clique da CTA, não delegado a um
  // guard de rota que poderia (ou não) existir em `/eventos/:id/assentos`.
  const ctaHref = authStatus === 'authenticated' ? seatsPath : `/entrar?redirect=${encodeURIComponent(seatsPath)}`
  const ctaDisabledReason = isCancelled
    ? 'Esta sessão foi cancelada.'
    : isPast
      ? 'Esta sessão já ocorreu.'
      : null

  return (
    <div className={styles.page}>
      {event.imageUrl && <img src={event.imageUrl} alt="" className={styles.poster} />}

      {ctaDisabledReason && (
        <p className={styles.statusBanner} role="status">
          {ctaDisabledReason}
        </p>
      )}

      <h1>{event.title}</h1>
      <p className={styles.meta}>
        {formatEventDate(event.startsAt, event.timezone)} - {event.venueName}, {event.venueCity}
      </p>

      <div className={styles.badges}>
        {sessionAttributeBadges(event).map((label) => (
          <Badge key={label}>{label}</Badge>
        ))}
        {event.genres.map((genre) => (
          <Badge key={genre}>{genre}</Badge>
        ))}
        {event.runtimeMinutes && <Badge>{event.runtimeMinutes} min</Badge>}
      </div>

      {event.synopsis && <p className={styles.synopsis}>{event.synopsis}</p>}

      <p className={styles.price}>A partir de {formatMoney(event.effectivePriceInCents, event.currency)}</p>

      {/* prova social discreta (§ etapa 05) -- mesma informação do back, sem
          inventar urgência artificial ("restam só 3!!") quando não é bem assim */}
      {capacity !== null && (
        <p className={styles.occupancy}>
          {sold} de {capacity} lugares ocupados
        </p>
      )}

      {ctaDisabledReason ? (
        <button type="button" className={styles.ctaDisabled} disabled title={ctaDisabledReason}>
          Escolher assentos
        </button>
      ) : (
        <Link to={ctaHref} className={styles.cta}>
          Escolher assentos
        </Link>
      )}
    </div>
  )
}
