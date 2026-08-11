import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { env } from './config/env'
import { prisma } from './lib/prisma'
import { errorHandler } from './middlewares/error.middleware'
import { requestLogger } from './middlewares/request-logger.middleware'
import { v1Router } from './routes/v1'

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  // desligado sob NODE_ENV=test -- a suíte de integração roda em série, no mesmo
  // processo, e compartilharia o mesmo contador entre todos os arquivos de teste
  skip: () => env.NODE_ENV === 'test',
})

export const app = express()

app.use(requestLogger) // 1º: todo request tem ID antes de tudo
app.use(helmet())
app.use(cors({ origin: env.CORS_ORIGINS, credentials: true })) // allowlist, nunca '*'

// body cru para a verificação de assinatura do Stripe -- precisa vir antes do express.json (etapa 07)
app.use('/api/v1/stripe/webhook', express.raw({ type: 'application/json' }))

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
