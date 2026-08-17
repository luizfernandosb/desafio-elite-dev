import { useState, type FormEvent } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { Button } from '../../../components'
import { stripePromise } from '../../../lib/stripe'
import styles from './StripeCardForm.module.css'

interface PaymentFormProps {
  orderId: string
  onSuccess: () => void
}

function PaymentForm({ orderId, onSuccess }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!stripe || !elements) return

    setIsSubmitting(true)
    setErrorMessage(null)

    // `redirect: 'if_required'` -- só sai da página pra cartões que exigem 3D Secure
    // (ex.: 4000 0025 0000 3155, já listado no TestCardsPanel); 4242... e a maioria
    // dos cartões de teste confirmam sem nunca redirecionar.
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/checkout/${orderId}/retorno` },
      redirect: 'if_required',
    })

    if (error) {
      setErrorMessage(error.message ?? 'Não foi possível concluir o pagamento. Tente de novo.')
      setIsSubmitting(false)
      return
    }

    onSuccess()
  }

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
      <PaymentElement />

      {errorMessage && (
        <p role="alert" className={styles.formError}>
          {errorMessage}
        </p>
      )}

      <Button type="submit" loading={isSubmitting} disabled={!stripe || !elements}>
        Pagar
      </Button>
    </form>
  )
}

interface StripeCardFormProps {
  clientSecret: string
  orderId: string
  onSuccess: () => void
}

// Caminho real do Stripe -- só existe atrás da flag de teste do checkout
// (VITE_ALLOW_PAYMENT_TEST_TOGGLE). Reaproveita o StripePaymentProvider já existente
// no back e os eventos `payment_intent.*` que o webhook já trata -- `onSuccess`
// navega pro mesmo destino (`/checkout/:id/retorno`) que o fluxo fake já usa; essa
// tela já sabe esperar o pedido virar PAID via polling, provedor-agnóstico.
export function StripeCardForm({ clientSecret, orderId, onSuccess }: StripeCardFormProps) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm orderId={orderId} onSuccess={onSuccess} />
    </Elements>
  )
}
