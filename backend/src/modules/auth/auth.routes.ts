import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { env } from '../../config/env'
import { requireAuth } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { AuthController } from './auth.controller'
import { googleSchema, loginSchema, registerSchema } from './auth.schema'
import { AuthRepository } from './auth.repository'
import { AuthService } from './auth.service'
import { GoogleAuthProvider } from './google.service'

const authRepository = new AuthRepository()
const googleProvider = new GoogleAuthProvider()
const authService = new AuthService(authRepository, googleProvider)
const authController = new AuthController(authService)

// desligado sob NODE_ENV=test -- a suíte de integração roda em série no mesmo
// processo (§7.10.2) e compartilharia o mesmo contador entre arquivos de teste
const skipInTest = () => env.NODE_ENV === 'test'

// por IP -- contém um atacante batendo em várias contas a partir do mesmo lugar
const perIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
})

// por e-mail -- contém varredura de senha distribuída por IP contra UMA conta (§7.8)
const perEmailLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.body?.email ?? '').trim().toLowerCase() || 'unknown',
  skip: skipInTest,
})

export const authRoutes = Router()

authRoutes.post('/register', perIpLimiter, validate(registerSchema), authController.register)
authRoutes.post(
  '/login',
  perIpLimiter,
  perEmailLoginLimiter,
  validate(loginSchema),
  authController.login,
)
authRoutes.post('/refresh', perIpLimiter, authController.refresh)
authRoutes.post('/logout', requireAuth, authController.logout)
authRoutes.post('/google', perIpLimiter, validate(googleSchema), authController.google)
authRoutes.get('/me', requireAuth, authController.me)
