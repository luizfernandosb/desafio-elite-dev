import { z } from 'zod'

export const envSchema = z.object({
  VITE_API_URL: z.string().url(),
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
  VITE_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  VITE_GOOGLE_CLIENT_ID: z.string().min(10).optional(),
  VITE_USE_MSW: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  VITE_ALLOW_PAYMENT_TEST_TOGGLE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
})
