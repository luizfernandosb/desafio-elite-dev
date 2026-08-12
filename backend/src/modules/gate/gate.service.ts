import type { Logger } from 'pino'
import { TicketStatus, ValidationResult } from '../../../generated/prisma/enums'
import { prisma } from '../../lib/prisma'
import { assertValidationWindow } from '../../shared/date'
import { AppError } from '../../shared/errors'
import { hashTicketCode, parseAndVerifyTicketCode } from '../tickets/qr.service'
import type { GateRepository } from './gate.repository'
import type { ValidateDto } from './gate.schema'

const CODE_PREFIX_LENGTH = 8

interface GateTicketView {
  seat: string | null
  eventTitle: string
}

export interface GateValidationResponse {
  result: ValidationResult
  ticket: GateTicketView | null // só presente em VALID e ALREADY_USED
  usedAt: Date | null
  validatedBy: string | null
  message: string
}

export interface GateStats {
  total: number
  used: number
  remaining: number
  lastValidations: Array<{ result: ValidationResult; createdAt: Date; ticketId: string | null }>
}

type TicketWithContext = {
  id: string
  eventId: string
  status: TicketStatus
  usedAt: Date | null
  event: { startsAt: Date; endsAt: Date | null; title: string }
  seat: { row: string; number: number } | null
  validatedBy: { name: string } | null
}

function toGateTicketView(ticket: Pick<TicketWithContext, 'seat' | 'event'>): GateTicketView {
  return {
    seat: ticket.seat ? `${ticket.seat.row}${ticket.seat.number}` : null,
    eventTitle: ticket.event.title,
  }
}

const MESSAGES: Record<ValidationResult, string> = {
  VALID: 'Entrada liberada',
  ALREADY_USED: 'Ingresso já utilizado',
  INVALID_SIGNATURE: 'Código inválido',
  NOT_FOUND: 'Ingresso não encontrado',
  WRONG_EVENT: 'Ingresso de outro evento',
  CANCELLED_TICKET: 'Ingresso cancelado',
  GATE_TOO_EARLY: 'Portaria ainda não abriu',
  GATE_CLOSED: 'Evento já encerrado',
}

export class GateService {
  constructor(private readonly repo: GateRepository) {}

  async validate(gateUserId: string, dto: ValidateDto, log: Logger): Promise<GateValidationResponse> {
    const codePrefix = dto.code.slice(0, CODE_PREFIX_LENGTH)

    // 1. formato + assinatura (CPU, sem tocar o banco) -- rejeita código forjado sem
    // gastar uma query (§7.6)
    const decoded = parseAndVerifyTicketCode(dto.code)
    if (!decoded) {
      await this.audit(dto.eventId, null, gateUserId, ValidationResult.INVALID_SIGNATURE, codePrefix, log)
      return this.negativeResult(ValidationResult.INVALID_SIGNATURE)
    }

    // 2. busca por codeHash -- nunca pelo ticketId do payload
    const codeHash = hashTicketCode(dto.code)
    const ticket = await this.repo.findByCodeHash(prisma, codeHash)
    if (!ticket) {
      await this.audit(dto.eventId, null, gateUserId, ValidationResult.NOT_FOUND, codePrefix, log)
      return this.negativeResult(ValidationResult.NOT_FOUND)
    }

    // 3. "evento errado" (FE-6) -- vem do vínculo posto↔evento, não de confiança no
    // que o cliente enviou: o eventId comparado é o do ticket já achado por codeHash
    if (ticket.eventId !== dto.eventId) {
      await this.audit(dto.eventId, ticket.id, gateUserId, ValidationResult.WRONG_EVENT, codePrefix, log)
      return this.negativeResult(ValidationResult.WRONG_EVENT)
    }

    // 4. cancelado
    if (ticket.status === TicketStatus.CANCELLED) {
      await this.audit(dto.eventId, ticket.id, gateUserId, ValidationResult.CANCELLED_TICKET, codePrefix, log)
      return this.negativeResult(ValidationResult.CANCELLED_TICKET)
    }

    // 5. janela de tempo do evento (§4.6.3)
    const windowFailure = this.checkWindow(ticket.event)
    if (windowFailure) {
      await this.audit(dto.eventId, ticket.id, gateUserId, windowFailure, codePrefix, log)
      return this.negativeResult(windowFailure)
    }

    // 6. único passo que escreve -- UPDATE atômico condicional, sem SELECT antes
    // decidir o resultado dele (§7.6)
    const used = await this.repo.markUsed(prisma, ticket.id, gateUserId)
    if (!used) {
      // corrida: outro leitor validou entre o findByCodeHash acima e este UPDATE --
      // relê para ter usedAt/validatedBy atuais, não os do momento do SELECT
      const current = (await this.repo.findByCodeHash(prisma, codeHash)) ?? ticket
      await this.audit(dto.eventId, ticket.id, gateUserId, ValidationResult.ALREADY_USED, codePrefix, log)
      return {
        result: ValidationResult.ALREADY_USED,
        ticket: toGateTicketView(current),
        usedAt: current.usedAt,
        validatedBy: current.validatedBy?.name ?? null,
        message: MESSAGES.ALREADY_USED,
      }
    }

    await this.audit(dto.eventId, ticket.id, gateUserId, ValidationResult.VALID, codePrefix, log)
    return {
      result: ValidationResult.VALID,
      ticket: toGateTicketView(ticket),
      usedAt: null,
      validatedBy: null,
      message: MESSAGES.VALID,
    }
  }

  async stats(eventId: string): Promise<GateStats> {
    const [total, used, lastValidations] = await Promise.all([
      this.repo.countTotal(prisma, eventId),
      this.repo.countUsed(prisma, eventId),
      this.repo.lastValidations(prisma, eventId, 10),
    ])
    return { total, used, remaining: total - used, lastValidations }
  }

  private checkWindow(event: { startsAt: Date; endsAt: Date | null }): ValidationResult | null {
    try {
      assertValidationWindow(event)
      return null
    } catch (err) {
      if (!(err instanceof AppError)) throw err
      return err.code === 'GATE_TOO_EARLY' ? ValidationResult.GATE_TOO_EARLY : ValidationResult.GATE_CLOSED
    }
  }

  private negativeResult(result: ValidationResult): GateValidationResponse {
    return { result, ticket: null, usedAt: null, validatedBy: null, message: MESSAGES[result] }
  }

  // fora da transação do UPDATE -- uma falha de log nunca derruba a validação
  // (portaria com fila não pode parar porque a auditoria falhou). §warn para tudo que
  // não é VALID: sequência de INVALID_SIGNATURE do mesmo operador é sinal de varredura.
  private async audit(
    eventId: string,
    ticketId: string | null,
    gateUserId: string,
    result: ValidationResult,
    codePrefix: string,
    log: Logger,
  ): Promise<void> {
    try {
      await this.repo.createLog(prisma, { eventId, ticketId, gateUserId, result, codePrefix })
    } catch (err) {
      log.error({ msg: 'validation log failed to write -- validação não foi afetada', err })
    }

    const level = result === ValidationResult.VALID ? 'info' : 'warn'
    log[level]({ msg: 'gate validation attempt', result, ticketId, eventId })
  }
}
