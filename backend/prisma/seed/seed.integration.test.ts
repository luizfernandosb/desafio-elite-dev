import { beforeEach, describe, expect, it } from 'vitest'
import { verifyTicketCode } from '../../src/modules/tickets/qr.service'
import { prisma } from '../../src/lib/prisma'
import { cleanDatabase } from '../../src/test/setup'
import { readDemoSummary } from './demo-summary'
import { runSeed } from './run'
import { SEED_PASSWORD } from './users.seed'

describe('seed (etapa 13, §6)', () => {
  beforeEach(cleanDatabase)

  it('popula o cenário completo -- 4 usuários, 3 eventos, 146 assentos, ≥1 ticket USED', async () => {
    await runSeed(prisma)

    const [users, events, seats, orders, tickets, usedTickets, activeHolds] = await Promise.all([
      prisma.user.count(),
      prisma.event.count(),
      prisma.seat.count(),
      prisma.order.count(),
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: 'USED' } }),
      prisma.seatHold.count({ where: { releasedAt: null } }),
    ])

    expect(users).toBe(4)
    expect(events).toBe(3)
    expect(seats).toBe(96 + 50) // Evento A + Evento B -- Evento C (DRAFT) nunca teve layout definido
    expect(orders).toBe(2)
    expect(tickets).toBe(3)
    expect(usedTickets).toBeGreaterThanOrEqual(1)
    expect(activeHolds).toBe(3)
  })

  it('rodar duas vezes seguidas não duplica nem quebra', async () => {
    await runSeed(prisma)
    await runSeed(prisma)

    const [users, events, seats, tickets] = await Promise.all([
      prisma.user.count(),
      prisma.event.count(),
      prisma.seat.count(),
      prisma.ticket.count(),
    ])

    expect(users).toBe(4)
    expect(events).toBe(3)
    expect(seats).toBe(146)
    expect(tickets).toBe(3)
  })

  it('os 4 usuários existem com a senha do README e os papéis certos', async () => {
    const { users } = await runSeed(prisma)

    expect(users.organizer.email).toBe('organizador@ticketdev.test')
    expect(users.customer1.email).toBe('cliente1@ticketdev.test')
    expect(users.customer2.email).toBe('cliente2@ticketdev.test')
    expect(users.gate.email).toBe('portaria@ticketdev.test')

    const organizer = await prisma.user.findUniqueOrThrow({ where: { id: users.organizer.id } })
    expect(organizer.role).toBe('ORGANIZER')
    // hash de verdade (argon2id), não um placeholder -- a mesma senha documentada verifica
    const argon2 = await import('argon2')
    await expect(argon2.verify(organizer.passwordHash as string, SEED_PASSWORD)).resolves.toBe(true)
  })

  it('GET /events (implícito): A e B são PUBLISHED, C é DRAFT', async () => {
    const { events } = await runSeed(prisma)

    const a = await prisma.event.findUniqueOrThrow({ where: { id: events.eventA.id } })
    const b = await prisma.event.findUniqueOrThrow({ where: { id: events.eventB.id } })
    const c = await prisma.event.findUniqueOrThrow({ where: { id: events.eventC.id } })

    expect(a.status).toBe('PUBLISHED')
    expect(b.status).toBe('PUBLISHED')
    expect(c.status).toBe('DRAFT')
  })

  it('o código impresso pelo seed passa em verifyTicketCode -- o QR semeado é válido de verdade', async () => {
    const { events } = await runSeed(prisma)
    const demo = await readDemoSummary(prisma, events.eventA.id)

    // mesmo critério de `readDemoSummary` (orderBy createdAt asc) -- Cliente 1 tem 2
    // tickets ACTIVE (D4, D5); sem essa ordenação, o achado aqui podia não ser o
    // mesmo cujo código `demo.activeCode` codifica
    const activeTicket = await prisma.ticket.findFirstOrThrow({
      where: { eventId: events.eventA.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    })
    const usedTicket = await prisma.ticket.findFirstOrThrow({ where: { eventId: events.eventA.id, status: 'USED' } })

    expect(demo.activeCode).not.toBeNull()
    expect(demo.usedCode).not.toBeNull()

    expect(verifyTicketCode(demo.activeCode as string, { ticketId: activeTicket.id, eventId: events.eventA.id })).toBe(true)
    expect(verifyTicketCode(demo.usedCode as string, { ticketId: usedTicket.id, eventId: events.eventA.id })).toBe(true)

    // evento errado -- o mesmo código, verificado contra o evento B, falha (prova que
    // a assinatura amarra o código a um evento específico, base do WRONG_EVENT real)
    expect(verifyTicketCode(demo.activeCode as string, { ticketId: activeTicket.id, eventId: events.eventB.id })).toBe(false)

    // código adulterado -- 1 caractere trocado no meio da assinatura invalida tudo
    const tampered = `${(demo.activeCode as string).slice(0, -1)}${(demo.activeCode as string).endsWith('A') ? 'B' : 'A'}`
    expect(verifyTicketCode(tampered, { ticketId: activeTicket.id, eventId: events.eventA.id })).toBe(false)
  })

  it('o shareToken semeado existe, não expirou e aponta para o ingresso do Cliente 1', async () => {
    const { events, users } = await runSeed(prisma)

    const shared = await prisma.ticket.findFirstOrThrow({
      where: { eventId: events.eventA.id, shareToken: { not: null } },
      include: { order: true },
    })

    expect(shared.shareRevokedAt).toBeNull()
    expect(shared.shareExpiresAt).not.toBeNull()
    expect((shared.shareExpiresAt as Date).getTime()).toBeGreaterThan(Date.now())
    expect(shared.order.userId).toBe(users.customer1.id)
  })
})
