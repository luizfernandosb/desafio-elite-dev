import { z } from 'zod'

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
