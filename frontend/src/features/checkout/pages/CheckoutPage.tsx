import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ErrorBoundary } from '../../../app/ErrorBoundary'
import { Button, EmptyState, ErrorState, Select, Skeleton, useToast } from '../../../components'
import { env } from '../../../lib/env'
import { formatMoney } from '../../../shared/money'
import { checkoutKeys, createOrder, getOrder, simulatePayment, type PaymentMethod, type SimulateOutcome } from '../api'
import { StripeCardForm } from '../components/StripeCardForm'
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

  // Flag de teste do checkout (invisível em produção normal) -- deixa escolher, por
  // pedido, entre o fluxo fake e o Stripe Elements de verdade. Com a flag desligada,
  // `methodConfirmed` já nasce `true` e o comportamento fica idêntico ao de sempre:
  // a order já nasce confirmada como FAKE e cria sozinha ao montar.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('FAKE')
  const [methodConfirmed, setMethodConfirmed] = useState(!env.VITE_ALLOW_PAYMENT_TEST_TOGGLE)

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
    refetch: refetchCreateOrder,
  } = useQuery({
    queryKey: checkoutKeys.createOrder(idempotencyKey),
    queryFn: () => createOrder(state.eventId as string, state.holdIds as string[], idempotencyKey, paymentMethod),
    enabled: canCreate && methodConfirmed,
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
    error: orderError,
    refetch: refetchOrder,
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

  // Só existe atrás da flag de teste (`methodConfirmed` já nasce `true` sem ela) --
  // escolhido antes da order ser criada, porque `paymentMethod` vai no corpo do
  // `POST /orders` (não dá pra trocar de método depois que o pedido já existe).
  if (isNewOrder && canCreate && !methodConfirmed) {
    return (
      <div className={styles.page}>
        <h1>Pagamento</h1>
        <Select
          label="Método de pagamento (teste)"
          options={[
            { value: 'FAKE', label: 'Simulado (atual)' },
            { value: 'STRIPE', label: 'Stripe (cartão de teste)' },
          ]}
          value={paymentMethod}
          onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
        />
        <Button onClick={() => setMethodConfirmed(true)}>Continuar</Button>
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
    // renderiza por um instante antes do redirect, ou para qualquer outro erro de
    // infraestrutura (rede/500/timeout), que cai no `ErrorState` central (§ etapa 11)
    return (
      <div className={styles.page}>
        <ErrorState error={createError} onRetry={() => refetchCreateOrder()} />
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
        <ErrorState error={orderError} onRetry={() => refetchOrder()} />
        <Link to="/">Voltar para o catálogo</Link>
      </div>
    )
  }

  if (!order) return null // só pra o TS -- os ramos acima já cobrem toda a falta de `order`

  // pedido já resolvido (revisita de uma URL antiga, F5 depois de pagar) -- a tela de
  // resultado é quem decide o que mostrar a partir do `order.status`, não aqui
  if (order.status !== 'PENDING') {
    return <Navigate to={`/checkout/${order.id}/retorno`} replace />
  }

  // `order.paymentMethod` (servidor) decide qual UI tentar, não o estado local --
  // um F5 de verdade reseta `paymentMethod`/`createdResult` (useState, cache do
  // TanStack Query em memória), mas a order já criada continua sendo Stripe.
  const usingStripe = order.paymentMethod === 'STRIPE'

  let paymentSection: ReactNode
  if (usingStripe && createdResult?.clientSecret) {
    paymentSection = (
      <StripeCardForm
        clientSecret={createdResult.clientSecret}
        orderId={order.id}
        onSuccess={() => navigate(`/checkout/${order.id}/retorno`)}
      />
    )
  } else if (usingStripe) {
    // F5 no meio do pagamento Stripe -- o clientSecret só existe na resposta do
    // POST /orders, nunca é regravado nem re-buscado depois (limitação aceita:
    // este caminho só existe atrás da flag de teste do checkout).
    paymentSection = (
      <EmptyState
        title="Não foi possível retomar o pagamento Stripe"
        description="Isso acontece quando a página é recarregada no meio do pagamento. Volte e tente de novo."
        action={<Link to={`/eventos/${order.eventId}/assentos`}>Voltar para o mapa de assentos</Link>}
      />
    )
  } else {
    paymentSection = (
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
    )
  }

  return (
    <div className={styles.page}>
      <h1>Pagamento</h1>
      <p className={styles.amount}>Total: {formatMoney(order.amountInCents, order.currency)}</p>
      {!usingStripe && (
        <p className={styles.notice}>Ambiente de simulação - nenhum cartão de verdade é processado aqui.</p>
      )}

      <TestCardsPanel />

      {/* Boundary por seção (§ etapa 11) -- Stripe Elements é um iframe de terceiro,
          historicamente o tipo de coisa que quebra em runtime. Um erro aqui não
          deveria levar nem o total já mostrado acima nem o header/nav do resto da
          aplicação. */}
      <ErrorBoundary>{paymentSection}</ErrorBoundary>
    </div>
  )
}
