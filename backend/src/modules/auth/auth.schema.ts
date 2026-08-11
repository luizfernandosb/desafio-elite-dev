import { z } from 'zod'

// TLD ≥ 2 caracteres, sem pontos consecutivos, sem ponto no fim -- checagem de domínio
// que complementa o `.email()` do Zod (§7.4). Não é regex artesanal de e-mail inteiro.
function isValidEmailDomain(domain: string): boolean {
  if (domain.length === 0) return false
  if (domain.startsWith('.') || domain.endsWith('.')) return false
  if (domain.includes('..')) return false

  const labels = domain.split('.')
  if (labels.length < 2 || labels.some((label) => label.length === 0)) return false

  const tld = labels[labels.length - 1] as string
  return tld.length >= 2 && /^[a-z]+$/i.test(tld)
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('E-mail inválido')
  .refine((email) => email.split('@').length === 2, 'E-mail inválido')
  .refine((email) => isValidEmailDomain(email.split('@')[1] ?? ''), 'E-mail inválido')

export const registerSchema = {
  body: z.object({
    name: z.string().trim().min(1).max(100),
    email: emailSchema,
    password: z.string().min(10, 'Senha deve ter ao menos 10 caracteres'),
    // nenhum campo `role` aqui -- endpoint público sempre cria CUSTOMER (§7.3).
    // um `role` enviado no corpo é descartado pelo `.strip()` implícito do Zod.
  }),
}

export const loginSchema = {
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Senha obrigatória'),
  }),
}

export const googleSchema = {
  body: z.object({
    credential: z.string().min(10, 'Credencial inválida'),
  }),
}

export type RegisterDto = z.infer<typeof registerSchema.body>
export type LoginDto = z.infer<typeof loginSchema.body>
export type GoogleDto = z.infer<typeof googleSchema.body>
