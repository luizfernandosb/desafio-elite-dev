import { z } from 'zod'

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().default(3000),
  TZ: z.literal('UTC'),

  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_QR_SECRET: z.string().min(32),

  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE: z.string().min(20),

  TMDB_API_KEY: z.string().min(10),
  GOOGLE_CLIENT_ID: z.string().min(10),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // base pública usada para montar o link de compartilhamento (etapa 09)
  APP_PUBLIC_URL: z.string().url(),
  // allowlist de origens para o CORS -- lista separada por vírgula, nunca '*'
  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((value) => value.split(',').map((origin) => origin.trim())),
})

export const env = envSchema.parse(process.env)
// lança ZodError com o campo exato se algo faltar -- processo não sobe
