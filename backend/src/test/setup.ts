import { execSync } from 'node:child_process'
import { beforeAll } from 'vitest'
import { prisma } from '../lib/prisma'

beforeAll(() => {
  // sem a opção `env` -- execSync já herda as variáveis do processo atual
  execSync('npx prisma migrate deploy', { stdio: 'inherit' })
})

// ordem respeita as foreign keys -- tabela dependente antes da que ela referencia
export async function cleanDatabase() {
  await prisma.$transaction([
    prisma.validationLog.deleteMany(),
    prisma.seatState.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.seatHold.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.processedWebhookEvent.deleteMany(),
    prisma.catalogCache.deleteMany(),
    prisma.order.deleteMany(),
    prisma.seat.deleteMany(),
    prisma.event.deleteMany(),
    prisma.user.deleteMany(),
  ])
}
