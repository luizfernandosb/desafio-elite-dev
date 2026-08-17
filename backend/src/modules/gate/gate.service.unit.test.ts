import type { Logger } from 'pino'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TicketStatus, ValidationResult } from '../../../generated/prisma/enums'
import { generateTicketCode } from '../tickets/qr.service'
import type { GateRepository } from './gate.repository'
import { GateService } from './gate.service'

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as Logger

const EVENT_ID = 'event-1'
const TICKET_ID = 'ticket-1'

function makeTicketRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: TICKET_ID,
    eventId: EVENT_ID,
    status: TicketStatus.ACTIVE,
    usedAt: null,
    event: { startsAt: new Date(Date.now() - 60 * 60 * 1000), endsAt: null, title: 'Show de teste' },
    seat: { row: 'F', number: 12 },
    validatedBy: null,
    ...overrides,
  }
}

function makeMockRepo(): GateRepository {
  return {
    findByCodeHash: vi.fn(),
    markUsed: vi.fn(),
    createLog: vi.fn(),
    countTotal: vi.fn(),
    countUsed: vi.fn(),
    lastValidations: vi.fn(),
  } as unknown as GateRepository
}

function validCode() {
  return generateTicketCode({ ticketId: TICKET_ID, eventId: EVENT_ID }).code
}

describe('GateService.validate -- ordem de checagem produz o result certo', () => {
  let repo: GateRepository

  beforeEach(() => {
    repo = makeMockRepo()
  })

  it('INVALID_SIGNATURE -- código forjado nunca chega a consultar o banco', async () => {
    const service = new GateService(repo)
    const result = await service.validate('gate-1', { code: 'lixo-forjado', eventId: EVENT_ID }, log)

    expect(result.result).toBe(ValidationResult.INVALID_SIGNATURE)
    expect(result.ticket).toBeNull()
    expect(repo.findByCodeHash).not.toHaveBeenCalled()
    expect(repo.createLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ result: ValidationResult.INVALID_SIGNATURE, ticketId: null }),
    )
  })

  it('NOT_FOUND -- assinatura válida, mas nenhum ticket com esse codeHash', async () => {
    vi.mocked(repo.findByCodeHash).mockResolvedValue(null)
    const service = new GateService(repo)

    const result = await service.validate('gate-1', { code: validCode(), eventId: EVENT_ID }, log)
    expect(result.result).toBe(ValidationResult.NOT_FOUND)
    expect(result.ticket).toBeNull()
  })

  it('WRONG_EVENT -- ticket existe, mas é de outro evento', async () => {
    vi.mocked(repo.findByCodeHash).mockResolvedValue(makeTicketRow({ eventId: 'outro-evento' }) as never)
    const service = new GateService(repo)

    const result = await service.validate('gate-1', { code: validCode(), eventId: EVENT_ID }, log)
    expect(result.result).toBe(ValidationResult.WRONG_EVENT)
    expect(result.ticket).toBeNull()
    expect(repo.markUsed).not.toHaveBeenCalled()
  })

  it('CANCELLED_TICKET', async () => {
    vi.mocked(repo.findByCodeHash).mockResolvedValue(makeTicketRow({ status: TicketStatus.CANCELLED }) as never)
    const service = new GateService(repo)

    const result = await service.validate('gate-1', { code: validCode(), eventId: EVENT_ID }, log)
    expect(result.result).toBe(ValidationResult.CANCELLED_TICKET)
    expect(repo.markUsed).not.toHaveBeenCalled()
  })

  it('GATE_TOO_EARLY -- evento mais de 2h no futuro', async () => {
    vi.mocked(repo.findByCodeHash).mockResolvedValue(
      makeTicketRow({ event: { startsAt: new Date(Date.now() + 3 * 60 * 60 * 1000), endsAt: null, title: 'x' } }) as never,
    )
    const service = new GateService(repo)

    const result = await service.validate('gate-1', { code: validCode(), eventId: EVENT_ID }, log)
    expect(result.result).toBe(ValidationResult.GATE_TOO_EARLY)
    expect(repo.markUsed).not.toHaveBeenCalled()
  })

  it('GATE_CLOSED -- evento encerrado há mais de 6h', async () => {
    vi.mocked(repo.findByCodeHash).mockResolvedValue(
      makeTicketRow({ event: { startsAt: new Date(Date.now() - 8 * 60 * 60 * 1000), endsAt: null, title: 'x' } }) as never,
    )
    const service = new GateService(repo)

    const result = await service.validate('gate-1', { code: validCode(), eventId: EVENT_ID }, log)
    expect(result.result).toBe(ValidationResult.GATE_CLOSED)
  })

  it('VALID -- chama markUsed e devolve o assento formatado', async () => {
    vi.mocked(repo.findByCodeHash).mockResolvedValue(makeTicketRow() as never)
    vi.mocked(repo.markUsed).mockResolvedValue(true)
    const service = new GateService(repo)

    const result = await service.validate('gate-1', { code: validCode(), eventId: EVENT_ID }, log)

    expect(result.result).toBe(ValidationResult.VALID)
    expect(result.ticket).toEqual({ seat: 'F12', eventTitle: 'Show de teste' })
    expect(repo.markUsed).toHaveBeenCalledWith(expect.anything(), TICKET_ID, 'gate-1')
  })

  it('ALREADY_USED -- markUsed falha (rowCount 0), relê para usedAt/validatedBy atuais', async () => {
    const firstRead = makeTicketRow()
    const afterRace = makeTicketRow({
      usedAt: new Date('2026-01-01T10:00:00Z'),
      validatedBy: { name: 'Operador Anterior' },
    })
    vi.mocked(repo.findByCodeHash).mockResolvedValueOnce(firstRead as never).mockResolvedValueOnce(afterRace as never)
    vi.mocked(repo.markUsed).mockResolvedValue(false)
    const service = new GateService(repo)

    const result = await service.validate('gate-1', { code: validCode(), eventId: EVENT_ID }, log)

    expect(result.result).toBe(ValidationResult.ALREADY_USED)
    expect(result.usedAt).toEqual(new Date('2026-01-01T10:00:00Z'))
    expect(result.validatedBy).toBe('Operador Anterior')
  })

  it('toda tentativa grava ValidationLog, inclusive as recusadas', async () => {
    vi.mocked(repo.findByCodeHash).mockResolvedValue(null)
    const service = new GateService(repo)

    await service.validate('gate-1', { code: validCode(), eventId: EVENT_ID }, log)
    expect(repo.createLog).toHaveBeenCalledTimes(1)
  })

  it('uma falha ao gravar o log nunca derruba a validação', async () => {
    vi.mocked(repo.findByCodeHash).mockResolvedValue(makeTicketRow() as never)
    vi.mocked(repo.markUsed).mockResolvedValue(true)
    vi.mocked(repo.createLog).mockRejectedValue(new Error('db indisponível'))
    const service = new GateService(repo)

    const result = await service.validate('gate-1', { code: validCode(), eventId: EVENT_ID }, log)
    expect(result.result).toBe(ValidationResult.VALID)
    expect(log.error).toHaveBeenCalled()
  })
})

describe('GateService.stats', () => {
  it('calcula remaining = total - used', async () => {
    const repo = makeMockRepo()
    vi.mocked(repo.countTotal).mockResolvedValue(100)
    vi.mocked(repo.countUsed).mockResolvedValue(37)
    vi.mocked(repo.lastValidations).mockResolvedValue([])
    const service = new GateService(repo)

    const stats = await service.stats(EVENT_ID)
    expect(stats).toEqual({ total: 100, used: 37, remaining: 63, lastValidations: [] })
  })
})
