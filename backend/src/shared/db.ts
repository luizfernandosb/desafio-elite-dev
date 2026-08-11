import type { Prisma, PrismaClient } from '../../generated/prisma/client'

// Repository recebe isto por parâmetro -- nunca usa o singleton diretamente dentro
// de uma transação (§5.5.2).
export type Db = PrismaClient | Prisma.TransactionClient
