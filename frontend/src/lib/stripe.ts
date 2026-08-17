import { loadStripe } from '@stripe/stripe-js'
import { env } from './env'

// Instância única do Stripe.js -- carregada uma vez, reaproveitada por qualquer
// <Elements> que precisar dela (hoje só StripeCardForm, flag de teste do checkout).
export const stripePromise = loadStripe(env.VITE_STRIPE_PUBLISHABLE_KEY)
