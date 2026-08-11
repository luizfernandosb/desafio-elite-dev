import { Role } from '../../../generated/prisma/enums'
import type { Db } from '../../shared/db'

interface CreateCustomerInput {
  email: string
  name: string
  passwordHash?: string | null
  googleSub?: string | null
  emailVerified: boolean
}

interface CreateRefreshTokenInput {
  userId: string
  jti: string
  tokenHash: string
  expiresAt: Date
}

export class AuthRepository {
  findByEmail(db: Db, email: string) {
    return db.user.findUnique({ where: { email } })
  }

  findByGoogleSub(db: Db, googleSub: string) {
    return db.user.findUnique({ where: { googleSub } })
  }

  findById(db: Db, id: string) {
    return db.user.findUnique({ where: { id } })
  }

  createCustomer(db: Db, data: CreateCustomerInput) {
    return db.user.create({ data: { ...data, role: Role.CUSTOMER } })
  }

  linkGoogleSub(db: Db, userId: string, googleSub: string) {
    return db.user.update({ where: { id: userId }, data: { googleSub, emailVerified: true } })
  }

  createRefreshToken(db: Db, data: CreateRefreshTokenInput) {
    return db.refreshToken.create({ data })
  }

  findRefreshTokenByJti(db: Db, jti: string) {
    return db.refreshToken.findUnique({ where: { jti } })
  }

  revokeRefreshToken(db: Db, id: string, replacedById?: string) {
    return db.refreshToken.update({ where: { id }, data: { revokedAt: new Date(), replacedById } })
  }

  revokeFamily(db: Db, userId: string) {
    return db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
}
