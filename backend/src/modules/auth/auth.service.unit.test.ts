import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Role } from '../../../generated/prisma/enums'
import { UnauthorizedError } from '../../shared/errors'
import type { AuthRepository } from './auth.repository'
import { AuthService } from './auth.service'
import type { GoogleProfile, SocialAuthProvider } from './google.service'

const makeUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'user-1',
  email: 'user@example.com',
  name: 'Usuário',
  role: Role.CUSTOMER,
  passwordHash: null,
  googleSub: null,
  ...overrides,
})

function makeMockAuthRepo(): AuthRepository {
  return {
    findByEmail: vi.fn(),
    findByGoogleSub: vi.fn(),
    findById: vi.fn(),
    createCustomer: vi.fn(),
    linkGoogleSub: vi.fn(),
    createRefreshToken: vi.fn().mockResolvedValue({ id: 'refresh-row-1' }),
    findRefreshTokenByJti: vi.fn(),
    revokeRefreshToken: vi.fn(),
    revokeFamily: vi.fn(),
  } as unknown as AuthRepository
}

function makeMockGoogleProvider(profile: Partial<GoogleProfile> = {}): SocialAuthProvider {
  return {
    verify: vi.fn().mockResolvedValue({
      sub: 'google-sub-1',
      email: 'user@example.com',
      emailVerified: true,
      name: 'Usuário Google',
      ...profile,
    }),
  }
}

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never

describe('AuthService.loginWithGoogle', () => {
  let authRepo: AuthRepository

  beforeEach(() => {
    authRepo = makeMockAuthRepo()
  })

  it('reaproveita a conta quando o googleSub já está vinculado', async () => {
    const existingGoogleUser = makeUser({ googleSub: 'google-sub-1' })
    vi.mocked(authRepo.findByGoogleSub).mockResolvedValue(existingGoogleUser as never)

    const service = new AuthService(authRepo, makeMockGoogleProvider())
    const session = await service.loginWithGoogle({ credential: 'token' }, log)

    expect(session.user.id).toBe('user-1')
    expect(authRepo.createCustomer).not.toHaveBeenCalled()
    expect(authRepo.linkGoogleSub).not.toHaveBeenCalled()
  })

  it('vincula a conta existente quando o e-mail já tem senha e o Google confirma email_verified', async () => {
    vi.mocked(authRepo.findByGoogleSub).mockResolvedValue(null)
    vi.mocked(authRepo.findByEmail).mockResolvedValue(makeUser({ passwordHash: 'hash' }) as never)
    vi.mocked(authRepo.linkGoogleSub).mockResolvedValue(
      makeUser({ passwordHash: 'hash', googleSub: 'google-sub-1' }) as never,
    )

    const service = new AuthService(authRepo, makeMockGoogleProvider())
    await service.loginWithGoogle({ credential: 'token' }, log)

    expect(authRepo.linkGoogleSub).toHaveBeenCalledWith(expect.anything(), 'user-1', 'google-sub-1')
    expect(authRepo.createCustomer).not.toHaveBeenCalled()
  })

  it('rejeita a vinculação quando o Google não confirma email_verified', async () => {
    vi.mocked(authRepo.findByGoogleSub).mockResolvedValue(null)
    vi.mocked(authRepo.findByEmail).mockResolvedValue(makeUser({ passwordHash: 'hash' }) as never)

    const service = new AuthService(authRepo, makeMockGoogleProvider({ emailVerified: false }))

    await expect(service.loginWithGoogle({ credential: 'token' }, log)).rejects.toThrow(
      UnauthorizedError,
    )
    expect(authRepo.linkGoogleSub).not.toHaveBeenCalled()
  })

  it('cria uma conta CUSTOMER nova quando nem o googleSub nem o e-mail existem', async () => {
    vi.mocked(authRepo.findByGoogleSub).mockResolvedValue(null)
    vi.mocked(authRepo.findByEmail).mockResolvedValue(null)
    vi.mocked(authRepo.createCustomer).mockResolvedValue(
      makeUser({ googleSub: 'google-sub-1' }) as never,
    )

    const service = new AuthService(authRepo, makeMockGoogleProvider())
    await service.loginWithGoogle({ credential: 'token' }, log)

    expect(authRepo.createCustomer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ googleSub: 'google-sub-1', emailVerified: true }),
    )
  })
})
