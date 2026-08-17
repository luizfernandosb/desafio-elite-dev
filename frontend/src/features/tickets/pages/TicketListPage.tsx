import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, Pagination, Skeleton } from '../../../components'
import { useQueryState } from '../../../shared/useQueryState'
import { listTickets, ticketKeys, type Ticket } from '../api'
import { TicketCard } from '../components/TicketCard'
import styles from './TicketListPage.module.css'

function splitByTime(tickets: Ticket[]): { upcoming: Ticket[]; past: Ticket[] } {
  const now = Date.now()
  const upcoming: Ticket[] = []
  const past: Ticket[] = []

  for (const ticket of tickets) {
    if (new Date(ticket.event.startsAt).getTime() >= now) upcoming.push(ticket)
    else past.push(ticket)
  }

  upcoming.sort((a, b) => new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime())
  past.sort((a, b) => new Date(b.event.startsAt).getTime() - new Date(a.event.startsAt).getTime())

  return { upcoming, past }
}

export default function TicketListPage() {
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ticketKeys.list(page),
    queryFn: () => listTickets(page),
  })

  const state = useQueryState(query, (data) => data.data.length === 0)

  if (state.status === 'loading') {
    return (
      <div className={styles.page}>
        <h1>Meus ingressos</h1>
        <div className={styles.list} aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} height="120px" radius="md" />
          ))}
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className={styles.page}>
        <h1>Meus ingressos</h1>
        <ErrorState error={state.error} onRetry={() => query.refetch()} />
      </div>
    )
  }

  if (state.status === 'empty') {
    return (
      <div className={styles.page}>
        <h1>Meus ingressos</h1>
        <EmptyState
          title="Você ainda não tem ingressos"
          description="Escolha uma sessão no catálogo e garanta seu lugar."
          action={<Link to="/">Ver catálogo</Link>}
        />
      </div>
    )
  }

  const { upcoming, past } = splitByTime(state.data.data)

  return (
    <div className={styles.page}>
      <h1>Meus ingressos</h1>

      {upcoming.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>Próximos</h2>
          <div className={styles.list}>
            {upcoming.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>Passados</h2>
          <div className={styles.list}>
            {past.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        </section>
      )}

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
