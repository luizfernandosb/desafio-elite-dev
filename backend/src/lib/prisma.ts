import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client'
import { env } from '../config/env'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// pooler em transaction mode (porta 6543, pgbouncer=true) -- runtime da aplicação (§5.3.1)
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

// evita reabrir conexões a cada hot-reload em desenvolvimento -- padrão globalThis
if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
