import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { env } from './config/env'
import { prisma } from './lib/prisma'
import { errorHandler } from './middlewares/error.middleware'
import { requestLogger } from './middlewares/request-logger.middleware'
import { stripeWebhookHandler } from './modules/orders/orders.routes'
import { v1Router } from './routes/v1'
import { RateLimitedError } from './shared/errors'

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (_req, _res, next) => next(new RateLimitedError()),
})

export const app = express()

app.use(requestLogger)
app.use(helmet())
app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }))

app.use('/api/v1/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler)

app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())
app.use(globalLimiter)

app.use('/api/v1', v1Router)

app.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`
  res.json({ status: 'ok', db: 'up' })
})

app.use((_req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Rota não encontrada' })
})

app.use(errorHandler)
