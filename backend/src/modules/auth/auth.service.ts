import { createHash, randomUUID } from 'node:crypto'
import type { Logger } from 'pino'
import { prisma } from '../../lib/prisma'
import { ConflictError, UnauthorizedError } from '../../shared/errors'
import type { Db } from '../../shared/db'
import type { Role } from '../../../generated/prisma/enums'
import type { AuthRepository } from './auth.repository'
import type { GoogleDto, LoginDto, RegisterDto } from './auth.schema'
import type { SocialAuthProvider } from './google.service'
import { hashPassword, verifyPasswordConstantTime } from './password.service'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './token.service'

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface PublicUser {
  id: string
  name: string
  email: string
  role: Role
}

interface UserRecord {
  id: string
  name: string
  email: string
  role: Role
}

function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface Session {
  accessToken: string
  refreshToken: string
  user: PublicUser
}

export class AuthService {
  constructor(
    private readonly authRepo: AuthRepository,
    private readonly googleProvider: SocialAuthProvider,
  ) {}

  async register(dto: RegisterDto, log: Logger): Promise<Session> {
    const existing = await this.authRepo.findByEmail(prisma, dto.email)
    if (existing) throw new ConflictError('EMAIL_TAKEN', 'E-mail já cadastrado')

    const passwordHash = await hashPassword(dto.password)
    const user = await this.authRepo.createCustomer(prisma, {
      email: dto.email,
      name: dto.name,
      passwordHash,
      emailVerified: false,
    })

    log.info({ msg: 'user registered', userId: user.id })
    return this.issueSession(prisma, user)
  }

  async login(dto: LoginDto, log: Logger): Promise<Session> {
    const user = await this.authRepo.findByEmail(prisma, dto.email)
    const passwordOk = await verifyPasswordConstantTime(user?.passwordHash ?? null, dto.password)

    if (!user || !passwordOk) {
      log.warn({ msg: 'login failed' })
      throw new UnauthorizedError('Credenciais inválidas')
    }

    log.info({ msg: 'user logged in', userId: user.id })
    return this.issueSession(prisma, user)
  }

  async loginWithGoogle(dto: GoogleDto, log: Logger): Promise<Session> {
    const profile = await this.googleProvider.verify(dto.credential)

    let user = await this.authRepo.findByGoogleSub(prisma, profile.sub)

    if (!user) {
      const existing = await this.authRepo.findByEmail(prisma, profile.email)

      if (existing) {
        if (!profile.emailVerified) {
          throw new UnauthorizedError('E-mail do Google não verificado')
        }
        user = await this.authRepo.linkGoogleSub(prisma, existing.id, profile.sub)
      } else {
        user = await this.authRepo.createCustomer(prisma, {
          email: profile.email,
          name: profile.name,
          googleSub: profile.sub,
          emailVerified: true,
        })
      }
    }

    log.info({ msg: 'user logged in via google', userId: user.id })
    return this.issueSession(prisma, user)
  }

  async refresh(presentedToken: string, log: Logger): Promise<Session> {
    const decoded = verifyRefreshToken(presentedToken)
    const stored = await this.authRepo.findRefreshTokenByJti(prisma, decoded.jti)

    if (!stored) throw new UnauthorizedError('Sessão inválida')

    if (stored.revokedAt || stored.tokenHash !== hashToken(presentedToken)) {
      log.warn({ msg: 'refresh token reuse detected', userId: stored.userId })
      await this.authRepo.revokeFamily(prisma, stored.userId)
      throw new UnauthorizedError('Sessão inválida')
    }

    const user = await this.authRepo.findById(prisma, stored.userId)
    if (!user) throw new UnauthorizedError('Sessão inválida')

    return prisma.$transaction(async (tx) => {
      const session = await this.issueSession(tx, user)
      await this.authRepo.revokeRefreshToken(tx, stored.id, session.refreshTokenRowId)
      return session
    })
  }

  async logout(presentedToken: string | undefined, log: Logger): Promise<void> {
    if (!presentedToken) return

    let decoded
    try {
      decoded = verifyRefreshToken(presentedToken)
    } catch {
      return
    }

    const stored = await this.authRepo.findRefreshTokenByJti(prisma, decoded.jti)
    if (stored && !stored.revokedAt) {
      await this.authRepo.revokeRefreshToken(prisma, stored.id)
      log.info({ msg: 'user logged out', userId: stored.userId })
    }
  }

  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.authRepo.findById(prisma, userId)
    if (!user) throw new UnauthorizedError('Sessão inválida')
    return toPublicUser(user)
  }

  private async issueSession(
    db: Db,
    user: UserRecord,
  ): Promise<Session & { refreshTokenRowId: string }> {
    const jti = randomUUID()
    const accessToken = signAccessToken({ sub: user.id, role: user.role })
    const refreshToken = signRefreshToken({ sub: user.id, role: user.role, jti })

    const refreshTokenRow = await this.authRepo.createRefreshToken(db, {
      userId: user.id,
      jti,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    })

    return {
      accessToken,
      refreshToken,
      user: toPublicUser(user),
      refreshTokenRowId: refreshTokenRow.id,
    }
  }
}
