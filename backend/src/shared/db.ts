import type { Prisma, PrismaClient } from '../../generated/prisma/client'

export type Db = PrismaClient | Prisma.TransactionClient
