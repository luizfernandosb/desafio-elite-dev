import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, ErrorState, Pagination, Skeleton, Tabs } from '../../../components'
import { formatEventDate } from '../../../shared/date'
import { formatMoney } from '../../../shared/money'
import { useQueryState } from '../../../shared/useQueryState'
import { listOrganizerEvents, organizadorKeys, type EventStatus, type OrganizerEvent } from '../api'
import { eventStatusLabel } from '../status'
import styles from './OrganizadorListPage.module.css'

const STATUS_TABS: { value: EventStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Rascunhos' },
  { value: 'PUBLISHED', label: 'Publicadas' },
  { value: 'CANCELLED', label: 'Canceladas' },
]

function emptyStateCopy(status: EventStatus): { title: string; description?: string } {
  if (status === 'DRAFT') {
    return { title: 'Nenhuma sessão em rascunho', description: 'Crie sua primeira sessão para começar a vender ingressos.' }
  }
  if (status === 'PUBLISHED') {
    return { title: 'Nenhuma sessão publicada ainda', description: 'Publique um rascunho para ele aparecer no catálogo público.' }
  }
  return { title: 'Nenhuma sessão cancelada' }
}

function EventRow({ event }: { event: OrganizerEvent }) {
  const sold = event._count.tickets
  // `_count.tickets` é o único número de vendas que a listagem devolve (§5.6.2) -- a
  // capacidade total exigiria o seatmap de cada evento (uma chamada a mais por linha),
  // então "vendidos/total" do plano vira só "vendidos" aqui; ver mapa de assentos na
  // própria página de gestão para a ocupação completa.
  const revenue = event.priceInCents * sold

  return (
    <Link to={`/organizador/eventos/${event.id}`} className={styles.rowLink}>
      <Card interactive className={styles.row}>
        <div className={styles.rowMain}>
          <p className={styles.rowTitle}>{event.title}</p>
          <p className={styles.rowMeta}>{formatEventDate(event.startsAt, event.timezone)}</p>
        </div>
        <Badge>{eventStatusLabel(event.status)}</Badge>
        <p className={styles.rowStat}>{sold} vendido{sold === 1 ? '' : 's'}</p>
        <p className={styles.rowStat}>{formatMoney(revenue)}</p>
      </Card>
    </Link>
  )
}

function EventStatusList({ status }: { status: EventStatus }) {
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: organizadorKeys.eventList({ status, page }),
    queryFn: () => listOrganizerEvents({ status, page }),
  })
  const state = useQueryState(query, (data) => data.data.length === 0)

  if (state.status === 'loading') {
    return (
      <div className={styles.list} aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} height="88px" radius="md" />
        ))}
      </div>
    )
  }

  if (state.status === 'error') {
    return <ErrorState error={state.error} onRetry={() => query.refetch()} />
  }

  if (state.status === 'empty') {
    const copy = emptyStateCopy(status)
    return (
      <EmptyState
        title={copy.title}
        description={copy.description}
        action={
          <Link to="/organizador/eventos/nova">
            <Button>Nova sessão</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className={styles.list}>
      {state.data.data.map((event) => (
        <EventRow key={event.id} event={event} />
      ))}
      <Pagination
        page={state.data.meta.page}
        totalPages={state.data.meta.totalPages}
        hasPrev={state.data.meta.hasPrev}
        hasNext={state.data.meta.hasNext}
        onPageChange={setPage}
      />
    </div>
  )
}

export default function OrganizadorListPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Minhas sessões</h1>
        <Link to="/organizador/eventos/nova">
          <Button>Nova sessão</Button>
        </Link>
      </div>
      <Tabs
        label="Sessões por status"
        items={STATUS_TABS.map((tab) => ({
          value: tab.value,
          label: tab.label,
          content: <EventStatusList status={tab.value} />,
        }))}
      />
    </div>
  )
}
