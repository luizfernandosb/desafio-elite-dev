import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorBoundary } from '../../../app/ErrorBoundary'
import { Badge, EmptyState, ErrorState, SeatMap, Skeleton, type SeatMapRow } from '../../../components'
import { formatEventDate } from '../../../shared/date'
import { sessionAttributeBadges } from '../../../shared/session-attributes'
import { applySeatPatch } from '../applySeatPatch'
import { getEvent, getSeatmap, reservaKeys, type Seatmap, type SeatHold } from '../api'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { HoldExpiredModal } from '../components/HoldExpiredModal'
import { SelectionBar, type SelectedSeatView } from '../components/SelectionBar'
import { useHold } from '../useHold'
import { isOwnSeatChange, useLiveAnnouncements } from '../useLiveAnnouncements'
import { usePollingFallback } from '../usePollingFallback'
import { useSeatRealtime } from '../useSeatRealtime'
import { useSeatSelection } from '../useSeatSelection'
import styles from './SeatSelectionPage.module.css'

export default function SeatSelectionPage() {
  const { id } = useParams<{ id: string }>()
  const eventId = id ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [hold, setHold] = useState<SeatHold[] | null>(null)
  const [holdExpired, setHoldExpired] = useState(false)
  const selection = useSeatSelection()
  const { announcement, announce } = useLiveAnnouncements()

  const {
    data: event,
    isLoading: isEventLoading,
    isError: isEventError,
    error: eventError,
    refetch: refetchEvent,
  } = useQuery({
    queryKey: reservaKeys.event(eventId),
    queryFn: () => getEvent(eventId),
    enabled: Boolean(eventId),
  })

  const {
    data: seatmap,
    isLoading: isSeatmapLoading,
    isError: isSeatmapError,
    error: seatmapError,
    refetch: refetchSeatmap,
  } = useQuery({
    queryKey: reservaKeys.seatmap(eventId),
    queryFn: () => getSeatmap(eventId),
    enabled: Boolean(eventId),
  })

  const { idByLabel, labelById } = useMemo(() => {
    const idByLabelMap = new Map<string, string>()
    const labelByIdMap = new Map<string, string>()
    for (const row of seatmap?.rows ?? []) {
      for (const seat of row.seats) {
        const label = `${row.row}${seat.number}`
        idByLabelMap.set(label, seat.id)
        labelByIdMap.set(seat.id, label)
      }
    }
    return { idByLabel: idByLabelMap, labelById: labelByIdMap }
  }, [seatmap])

  const connectionStatus = useSeatRealtime(eventId, (patch) => {
    queryClient.setQueryData(reservaKeys.seatmap(eventId), (old: Seatmap | undefined) =>
      old ? applySeatPatch(old, patch) : old,
    )

    const ownSeatIds = [...selection.selectedSeatIds, ...(hold?.map((h) => h.seatId) ?? [])]
    if (isOwnSeatChange(patch.seatId, ownSeatIds)) return

    const label = labelById.get(patch.seatId)
    if (label) announce({ seatId: patch.seatId, label, status: patch.status })
  })
  usePollingFallback(connectionStatus, eventId)

  const mapRows: SeatMapRow[] = useMemo(
    () =>
      (seatmap?.rows ?? []).map((row) => ({
        row: row.row,
        seats: row.seats.map((seat) => ({
          label: `${row.row}${seat.number}`,
          status: seat.status,
          selected: selection.selectedSeatIds.includes(seat.id),
        })),
      })),
    [seatmap, selection.selectedSeatIds],
  )

  const { hold: createHold, isPending: isReserving } = useHold({
    eventId,
    onHoldCreated: (createdHold) => {
      setHold(createdHold)
      selection.clear()
      void queryClient.invalidateQueries({ queryKey: reservaKeys.seatmap(eventId) })
    },
    onSeatsTaken: (takenSeatIds) => {
      selection.removeMany(takenSeatIds)
      void queryClient.invalidateQueries({ queryKey: reservaKeys.seatmap(eventId) })
    },
  })

  function handleSeatClick(label: string) {
    const seatId = idByLabel.get(label)
    if (seatId) selection.toggle(seatId)
  }

  function handleReserve() {
    if (selection.selectedSeats.length > 0) createHold(selection.selectedSeats)
  }

  function handleExpire() {
    setHold(null)
    setHoldExpired(true)
  }

  function handleChooseAgain() {
    setHoldExpired(false)
    setHold(null)
    void queryClient.invalidateQueries({ queryKey: reservaKeys.seatmap(eventId) })
  }

  function handleProceed() {
    if (!hold) return
    navigate('/checkout/novo', { state: { eventId, holdIds: hold.map((h) => h.id) } })
  }

  if (isEventLoading || isSeatmapLoading) {
    return (
      <div className={styles.page}>
        <Skeleton height="28px" width="50%" />
        <Skeleton height="400px" radius="md" />
      </div>
    )
  }

  if (isEventError || isSeatmapError || !event || !seatmap) {
    return (
      <div className={styles.page}>
        <ErrorState
          error={eventError ?? seatmapError}
          onRetry={() => {
            void refetchEvent()
            void refetchSeatmap()
          }}
        />
        <Link to={`/eventos/${eventId}`}>Voltar para a sessão</Link>
      </div>
    )
  }

  const isPast = new Date(event.startsAt).getTime() <= Date.now()
  if (event.status !== 'PUBLISHED' || isPast) {
    return (
      <div className={styles.page}>
        <EmptyState
          title="Esta sessão não está mais disponível para reserva"
          description={event.status !== 'PUBLISHED' ? 'A sessão foi cancelada.' : 'A sessão já ocorreu.'}
          action={<Link to={`/eventos/${eventId}`}>Voltar para a sessão</Link>}
        />
      </div>
    )
  }

  const selectedSeatsView: SelectedSeatView[] = selection.selectedSeats
    .map((seat) => {
      const label = labelById.get(seat.seatId)
      return label ? { ...seat, label } : null
    })
    .filter((seat): seat is SelectedSeatView => Boolean(seat))

  return (
    <div className={styles.page}>
      <div>
        <h1>{event.title}</h1>
        <p className={styles.meta}>
          {formatEventDate(event.startsAt, event.timezone)} - {event.venueName}, {event.venueCity}
        </p>
        <div className={styles.badges}>
          {sessionAttributeBadges(event).map((label) => (
            <Badge key={label}>{label}</Badge>
          ))}
        </div>
      </div>

      <div className={styles.mapHeader}>
        <ConnectionBadge status={connectionStatus} />
      </div>

      <ErrorBoundary>
        <SeatMap
          rows={mapRows}
          onSeatClick={handleSeatClick}
          legend
          showScreen
          ariaLabel={`Mapa de assentos - ${event.venueName}`}
        />
      </ErrorBoundary>

      <div role="status" aria-live="polite" aria-atomic="false" className="sr-only">
        {announcement}
      </div>

      <SelectionBar
        selectedSeats={selectedSeatsView}
        effectivePriceInCents={seatmap.meta.effectivePriceInCents}
        currency={seatmap.meta.currency}
        onChangePriceType={selection.setPriceType}
        onReserve={handleReserve}
        isReserving={isReserving}
        atMax={selection.atMax}
        hold={hold}
        onExpire={handleExpire}
        onProceed={handleProceed}
      />

      <HoldExpiredModal open={holdExpired} onChooseAgain={handleChooseAgain} />
    </div>
  )
}
