import { z } from 'zod'

function isValidEmailDomain(domain: string): boolean {
  if (domain.length === 0) return false
  if (domain.startsWith('.') || domain.endsWith('.')) return false
  if (domain.includes('..')) return false

  const labels = domain.split('.')
  if (labels.length < 2 || labels.some((label) => label.length === 0)) return false

  const tld = labels[labels.length - 1] ?? ''
  return tld.length >= 2 && /^[a-z]+$/i.test(tld)
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('E-mail inválido')
  .refine((email) => email.split('@').length === 2, 'E-mail inválido')
  .refine((email) => isValidEmailDomain(email.split('@')[1] ?? ''), 'E-mail inválido')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Senha obrigatória'),
})

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(100),
  email: emailSchema,
  password: z.string().min(10, 'Senha deve ter ao menos 10 caracteres'),
})

export type LoginFormValues = z.infer<typeof loginSchema>
export type RegisterFormValues = z.infer<typeof registerSchema>
