import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Skeleton } from '../../../components'
import { formatEventDate } from '../../../shared/date'
import { getSharedTicket, ticketKeys } from '../api'
import { publicShareErrorMessage } from '../error-messages'
import styles from './SharedTicketPage.module.css'

const QR_SIZE = 220

// Dupla garantia contra indexação (§ etapa 09) -- o back já manda `X-Robots-Tag:
// noindex` (`share.controller.ts`), esta tag espelha a mesma intenção no HTML em si.
// Sem lib de `<head>` no projeto (nenhuma outra tela precisou até agora): a tag é
// inserida/removida a mão, com o mesmo ciclo de vida da página.
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => {
      document.head.removeChild(meta)
    }
  }, [])
}

// Layout próprio, deliberadamente mais simples que o resto da aplicação (§ etapa 09)
// -- é a tela que um estranho abre a partir de um link, sem <Layout> (sem logo, sem
// nav, sem sessão). Rota montada fora da árvore de `<Layout>` no router.
export default function SharedTicketPage() {
  useNoIndex()

  const { shareToken } = useParams<{ shareToken: string }>()
  const token = shareToken ?? ''

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ticketKeys.shared(token),
    queryFn: () => getSharedTicket(token),
    enabled: Boolean(token),
    retry: false,
  })

  if (isLoading) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <Skeleton height="200px" radius="md" />
          <Skeleton height="24px" width="70%" />
        </div>
      </main>
    )
  }

  if (isError || !data) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <p role="alert" className={styles.errorText}>
            {publicShareErrorMessage(error)}
          </p>
          <Link to="/" className={styles.homeLink}>
            Ir para o catálogo
          </Link>
        </div>
      </main>
    )
  }

  const { event, seat, ticket } = data
  const isUsed = ticket.status === 'USED'

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        {event.imageUrl && <img src={event.imageUrl} alt="" className={styles.poster} />}
        <h1 className={styles.title}>{event.title}</h1>
        <p className={styles.meta}>{formatEventDate(event.startsAt, event.timezone)}</p>
        <p className={styles.meta}>
          {event.venueName} - {event.venueCity}
        </p>
        <p className={styles.seat}>
          {seat ? `Fileira ${seat.row}, assento ${seat.number}` : 'Assento não atribuído'}
        </p>

        <div className={styles.qrWrapper}>
          <div className={isUsed ? styles.qrDimmed : undefined}>
            <QRCodeSVG value={ticket.code} size={QR_SIZE} bgColor="#ffffff" fgColor="#000000" />
          </div>
          {isUsed && <div className={styles.usedStamp}>Já utilizado</div>}
        </div>
      </div>
    </main>
  )
}
