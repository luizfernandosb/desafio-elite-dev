import { describe, expect, it } from 'vitest'
import { emailSchema } from './auth.schema'

describe('emailSchema', () => {
  it.each(['a@b.com', 'a@b.com.br', 'usuario.nome@empresa.com.br'])(
    'aceita %s',
    (email) => {
      expect(emailSchema.safeParse(email).success).toBe(true)
    },
  )

  it.each(['a@b.', 'a@@b.com', 'a@b..com', 'nao-e-email', 'a@'])(
    'rejeita %s',
    (email) => {
      expect(emailSchema.safeParse(email).success).toBe(false)
    },
  )

  it('normaliza para minúsculas e sem espaços nas bordas', () => {
    const result = emailSchema.safeParse('  Usuario@Exemplo.COM  ')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe('usuario@exemplo.com')
  })
})
