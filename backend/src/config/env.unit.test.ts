import { describe, expect, it } from 'vitest'
import { envSchema } from './env'

const validEnv = {
  NODE_ENV: 'test',
  PORT: '3001',
  TZ: 'UTC',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/ticketdev_test',
  DIRECT_URL: 'postgresql://postgres:postgres@localhost:5432/ticketdev_test',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_QR_SECRET: 'c'.repeat(32),
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_x',
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_SERVICE_ROLE: 'a'.repeat(20),
  TMDB_API_KEY: 'a'.repeat(10),
  GOOGLE_CLIENT_ID: 'a'.repeat(10),
  APP_PUBLIC_URL: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:5173',
}

describe('envSchema', () => {
  it('aceita um conjunto de variáveis válido', () => {
    expect(envSchema.safeParse(validEnv).success).toBe(true)
  })

  it('rejeita TZ diferente de UTC', () => {
    const result = envSchema.safeParse({ ...validEnv, TZ: 'America/Sao_Paulo' })
    expect(result.success).toBe(false)
  })

  it('rejeita segredo JWT com menos de 32 caracteres', () => {
    const result = envSchema.safeParse({ ...validEnv, JWT_ACCESS_SECRET: 'curto-demais' })
    expect(result.success).toBe(false)
  })
})
