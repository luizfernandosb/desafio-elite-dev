import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button, EmptyState, Select, Skeleton, useToast } from '../../../components'
import { formatMoney } from '../../../shared/money'
import { checkoutKeys, createOrder, getOrder, simulatePayment, type SimulateOutcome } from '../api'
import { TestCardsPanel } from '../components/TestCardsPanel'
import { checkoutErrorMessage, isHoldExpired } from '../error-messages'
import { useIdempotencyKey } from '../useIdempotencyKey'
import styles from './CheckoutPage.module.css'

interface CheckoutLocationState {
  eventId?: string
  holdIds?: string[]
}

// Fase fake (Dia 2, § etapa 08) -- seletor aprovar/recusar chamando
// `POST /orders/:id/simulate-payment` em vez do Stripe Elements. O restante (criação
// do pedido, navegação, tela de resultado) é o que continua igual quando o Dia 3
// trocar este formulário pelo real -- ver docs/bugs.md #21 e README sobre o porquê
// dessa rota de simulação existir no back.
export default function CheckoutPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const idempotencyKey = useIdempotencyKey()
  const { showToast } = useToast()

  const isNewOrder = orderId === 'novo'
  const state = (location.state ?? {}) as CheckoutLocationState
  const canCreate = isNewOrder && Boolean(state.eventId) && Boolean(state.holdIds?.length)

  // Criação automática ao entrar vindo do mapa (§ etapa 08) -- não é um botão que o
  // cliente aperta. `useQuery` (não `useMutation`) de propósito: a chave de cache é
  // a própria `Idempotency-Key`, estável por sessão de checkout (`useIdempotencyKey`)
  // -- duas montagens concorrentes (StrictMode, re-render) compartilham a MESMA
  // promise em vez de disparar duas requisições, de graça, via o cache do próprio
  // TanStack Query.
  const {
    data: createdResult,
    isLoading: isCreating,
    isError: isCreateError,
    error: createError,
  } = useQuery({
    queryKey: checkoutKeys.createOrder(idempotencyKey),
    queryFn: () => createOrder(state.eventId as string, state.holdIds as string[], idempotencyKey),
    enabled: canCreate,
  })

  useEffect(() => {
    if (createdResult) navigate(`/checkout/${createdResult.order.id}`, { replace: true })
  }, [createdResult, navigate])

  useEffect(() => {
    if (!isCreateError || !state.eventId) return
    // HOLD_EXPIRED nunca vira um erro solto no checkout -- volta ao mapa com a
    // mensagem já descrita na etapa 06 (§ etapa 08)
    if (isHoldExpired(createError)) {
      showToast(checkoutErrorMessage(createError), 'danger')
      navigate(`/eventos/${state.eventId}/assentos`, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `state` é recriado a
    // cada render (spread de location.state); `state.eventId` já é a dependência real
  }, [isCreateError, createError, state.eventId, navigate, showToast])

  const {
    data: order,
    isLoading: isOrderLoading,
    isError: isOrderError,
  } = useQuery({
    queryKey: checkoutKeys.order(orderId ?? ''),
    queryFn: () => getOrder(orderId as string),
    enabled: !isNewOrder && Boolean(orderId),
  })

  const [outcome, setOutcome] = useState<SimulateOutcome>('succeeded')
  const {
    mutate: submitPayment,
    isPending: isSubmitting,
    error: submitError,
  } = useMutation({
    mutationFn: () => simulatePayment(order!.id, outcome),
    onSuccess: () => navigate(`/checkout/${order!.id}/retorno`),
  })

  if (isNewOrder && !canCreate) {
    return (
      <div className={styles.page}>
        <EmptyState
          title="Sessão de checkout inválida"
          description="Volte e escolha os assentos de novo."
          action={<Link to="/">Voltar para o catálogo</Link>}
        />
      </div>
    )
  }

  if (isNewOrder && (isCreating || createdResult)) {
    return (
      <div className={styles.page}>
        <Skeleton height="28px" width="50%" />
        <Skeleton height="240px" radius="md" />
      </div>
    )
  }

  if (isNewOrder && isCreateError) {
    // HOLD_EXPIRED já foi tratado (redirect) no efeito acima -- este ramo só
    // renderiza por um instante antes do redirect, ou para qualquer outro erro
    return (
      <div className={styles.page}>
        <EmptyState title="Não foi possível iniciar o pagamento" description={checkoutErrorMessage(createError)} />
      </div>
    )
  }

  if (!isNewOrder && isOrderLoading) {
    return (
      <div className={styles.page}>
        <Skeleton height="28px" width="50%" />
        <Skeleton height="240px" radius="md" />
      </div>
    )
  }

  if (!isNewOrder && (isOrderError || !order)) {
    return (
      <div className={styles.page}>
        <EmptyState title="Pedido não encontrado" action={<Link to="/">Voltar para o catálogo</Link>} />
      </div>
    )
  }

  if (!order) return null // só pra o TS -- os ramos acima já cobrem toda a falta de `order`

  // pedido já resolvido (revisita de uma URL antiga, F5 depois de pagar) -- a tela de
  // resultado é quem decide o que mostrar a partir do `order.status`, não aqui
  if (order.status !== 'PENDING') {
    return <Navigate to={`/checkout/${order.id}/retorno`} replace />
  }

  return (
    <div className={styles.page}>
      <h1>Pagamento</h1>
      <p className={styles.amount}>Total: {formatMoney(order.amountInCents, order.currency)}</p>
      <p className={styles.notice}>Ambiente de simulação -- nenhum cartão de verdade é processado aqui.</p>

      <TestCardsPanel />

      <div className={styles.form}>
        <Select
          label="Resultado do pagamento (simulação)"
          options={[
            { value: 'succeeded', label: 'Aprovar pagamento' },
            { value: 'requires_payment_method', label: 'Recusar pagamento' },
          ]}
          value={outcome}
          onValueChange={(value) => setOutcome(value as SimulateOutcome)}
        />

        {submitError && (
          <p role="alert" className={styles.formError}>
            {checkoutErrorMessage(submitError)}
          </p>
        )}

        <Button onClick={() => submitPayment()} loading={isSubmitting}>
          Pagar {formatMoney(order.amountInCents, order.currency)}
        </Button>
      </div>
    </div>
  )
}
