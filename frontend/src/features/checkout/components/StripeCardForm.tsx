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

export function StripeCardForm({ clientSecret, orderId, onSuccess }: StripeCardFormProps) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm orderId={orderId} onSuccess={onSuccess} />
    </Elements>
  )
}
