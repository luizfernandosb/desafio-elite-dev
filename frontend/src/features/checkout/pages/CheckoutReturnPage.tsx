import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, EmptyState, ErrorState, Skeleton, useToast } from '../../../components'
import { formatMoney } from '../../../shared/money'
import { checkoutKeys, createOrder, getOrder } from '../api'
import { checkoutErrorMessage, isHoldExpired } from '../error-messages'
import styles from './CheckoutReturnPage.module.css'

const MAX_POLLS = 3
const POLL_INTERVAL_MS = 1000

export default function CheckoutReturnPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [pollCount, setPollCount] = useState(0)

  const {
    data: order,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: checkoutKeys.order(orderId ?? ''),
    queryFn: () => getOrder(orderId as string),
    enabled: Boolean(orderId),
  })

  useEffect(() => {
    if (order?.status !== 'PENDING' || pollCount >= MAX_POLLS || !orderId) return

    const timer = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: checkoutKeys.order(orderId) })
      setPollCount((count) => count + 1)
    }, POLL_INTERVAL_MS)

    return () => clearTimeout(timer)
  }, [order?.status, pollCount, orderId, queryClient])

  function handleCheckAgain() {
    if (!orderId) return
    setPollCount(0)
    void queryClient.invalidateQueries({ queryKey: checkoutKeys.order(orderId) })
  }

  const {
    mutate: retryWithNewOrder,
    isPending: isRetrying,
    error: retryError,
  } = useMutation({
    mutationFn: () => {
      const activeSeatIds = order!.holds
        .filter((hold) => !hold.releasedAt && new Date(hold.expiresAt).getTime() > Date.now())
        .map((hold) => hold.seatId)
      return createOrder(order!.eventId, activeSeatIds, crypto.randomUUID())
    },
    onSuccess: (result) => navigate(`/checkout/${result.order.id}`, { replace: true }),
    onError: (err) => {
      if (isHoldExpired(err)) {
        showToast(checkoutErrorMessage(err), 'danger')
        navigate(`/eventos/${order!.eventId}/assentos`, { replace: true })
      }
    },
  })

  if (isLoading) {
    return (
      <div className={styles.page}>
        <Skeleton height="32px" width="60%" />
        <Skeleton height="120px" radius="md" />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className={styles.page}>
        <ErrorState error={error} onRetry={() => refetch()} />
        <Link to="/">Voltar para o catálogo</Link>
      </div>
    )
  }

  if (order.status === 'PAID' || order.status === 'FULFILLED') {
    return (
      <div className={`${styles.page} ${styles.approved}`}>
        <h1>Pagamento aprovado</h1>
        <p>
          Seu ingresso para {formatMoney(order.amountInCents, order.currency)} foi confirmado. Ele já está
          disponível em "Meus ingressos".
        </p>
        <Link to="/ingressos">
          <Button>Ver meus ingressos</Button>
        </Link>
      </div>
    )
  }

  if (order.status === 'FAILED') {
    const canRetry = order.holds.some(
      (hold) => !hold.releasedAt && new Date(hold.expiresAt).getTime() > Date.now(),
    )

    return (
      <div className={`${styles.page} ${styles.declined}`}>
        <h1>Pagamento recusado</h1>
        <p>Não foi possível processar o pagamento. Os assentos escolhidos continuam reservados por enquanto.</p>
        {retryError && (
          <p role="alert" className={styles.formError}>
            {checkoutErrorMessage(retryError)}
          </p>
        )}
        {canRetry ? (
          <Button onClick={() => retryWithNewOrder()} loading={isRetrying}>
            Tentar outro cartão
          </Button>
        ) : (
          <Link to={`/eventos/${order.eventId}/assentos`}>Escolher assentos de novo</Link>
        )}
      </div>
    )
  }

  if (order.status === 'EXPIRED') {
    return (
      <div className={styles.page}>
        <EmptyState
          title="O tempo para pagar esgotou"
          description="Os assentos foram liberados."
          action={<Link to={`/eventos/${order.eventId}`}>Voltar para a sessão</Link>}
        />
      </div>
    )
  }

  if (order.status === 'REFUNDED') {
    return (
      <div className={styles.page}>
        <EmptyState title="Pedido reembolsado" action={<Link to="/">Voltar para o catálogo</Link>} />
      </div>
    )
  }

  const stillPolling = pollCount < MAX_POLLS
  return (
    <div className={styles.page}>
      {stillPolling ? (
        <>
          <h1>Confirmando seu pagamento…</h1>
          <p>Isso costuma levar só alguns segundos.</p>
        </>
      ) : (
        <EmptyState
          title="Estamos confirmando seu pagamento"
          description="Ainda não recebemos a confirmação - isso pode ser só demora, não necessariamente uma falha."
          action={
            <Button variant="secondary" onClick={handleCheckAgain}>
              Verificar novamente
            </Button>
          }
        />
      )}
    </div>
  )
}
