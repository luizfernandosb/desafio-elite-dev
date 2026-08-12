import type { Logger } from 'pino'
import { CatalogSource, EventStatus, EventType } from '../../../generated/prisma/enums'
import { prisma } from '../../lib/prisma'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors'
import { paginate, type PaginatedResponse } from '../../shared/pagination'
import { assertTransition, EVENT_TRANSITIONS } from '../../shared/state-machines'
import type { CatalogService } from '../catalog/catalog.service'
import type { CreateEventDto, ListEventsQuery, UpdateEventDto } from './events.schema'
import type { EventsRepository } from './events.repository'
import { buildSeatmap, generateSeats, type Seatmap } from './seatmap.service'

// campos que alteram o contrato de compra -- bloqueados por PATCH depois da primeira venda
const SALE_LOCKED_FIELDS = ['startsAt', 'endsAt', 'timezone', 'priceInCents', 'venueCity'] as const

interface Requester {
  id: string
  role: string
}

export class EventsService {
  constructor(
    private readonly repo: EventsRepository,
    private readonly catalogService: CatalogService,
  ) {}

  async create(userId: string, dto: CreateEventDto, log: Logger) {
    const catalogItem = await this.catalogService.getById(dto.externalId, log)
    const seats = generateSeats(dto.layout)

    const event = await prisma.$transaction(async (tx) => {
      const created = await this.repo.create(tx, {
        organizerId: userId,
        source: CatalogSource.TMDB,
        externalId: dto.externalId,
        title: catalogItem.title,
        subtitle: catalogItem.subtitle,
        synopsis: catalogItem.synopsis,
        imageUrl: catalogItem.imageUrl,
        catalogImageUrl: catalogItem.imageUrl, // snapshot imutável -- fallback do DELETE /events/:id/image (etapa 12)
        runtimeMinutes: catalogItem.runtimeMinutes,
        genres: catalogItem.genres,
        venueName: dto.venueName,
        venueCity: dto.venueCity,
        type: EventType.SEATED,
        status: EventStatus.DRAFT,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        timezone: dto.timezone,
        priceInCents: dto.priceInCents,
      })

      await this.repo.createSeats(
        tx,
        seats.map((seat) => ({ id: seat.id, eventId: created.id, row: seat.row, number: seat.number, kind: seat.kind })),
      )
      await this.repo.createSeatStates(
        tx,
        seats.map((seat) => ({ seatId: seat.id, eventId: created.id })),
      )

      return created
    })

    log.info({ msg: 'event created', eventId: event.id, seatCount: seats.length })
    return event
  }

  async getById(id: string, requester: Requester | undefined) {
    const event = await this.repo.findById(prisma, id)
    if (!event || !this.isVisibleTo(event, requester)) throw new NotFoundError('Evento')
    return event
  }

  async list(query: ListEventsQuery, requester: Requester | undefined) {
    const where: Parameters<EventsRepository['findMany']>[1] = {
      status: query.status,
      startsAt: { gte: query.from, lte: query.to },
      title: query.q ? { contains: query.q, mode: 'insensitive' } : undefined,
    }

    if (query.status !== EventStatus.PUBLISHED) {
      // rascunho/cancelado só é visível para o próprio organizador -- nunca vaza para outro
      if (requester?.role !== 'ORGANIZER') throw new ForbiddenError()
      where.organizerId = requester.id
    }

    const { data, total } = await this.repo.findMany(
      prisma,
      where,
      (query.page - 1) * query.limit,
      query.limit,
    )

    return paginate(data, total, query) as PaginatedResponse<(typeof data)[number]>
  }

  async update(id: string, userId: string, dto: UpdateEventDto, log: Logger) {
    const event = await this.repo.findById(prisma, id)
    if (!event) throw new NotFoundError('Evento')
    this.assertOwner(event, userId)

    const hasSales = event._count.tickets > 0
    if (hasSales) {
      const blocked = SALE_LOCKED_FIELDS.filter((field) => dto[field] !== undefined)
      if (blocked.length > 0) {
        throw new ConflictError(
          'EVENT_HAS_SALES',
          `Campos bloqueados após a primeira venda: ${blocked.join(', ')}`,
        )
      }
    }

    const nextStartsAt = dto.startsAt ?? event.startsAt
    const nextEndsAt = dto.endsAt ?? event.endsAt
    if (dto.startsAt && dto.startsAt.getTime() <= Date.now()) {
      throw new ValidationError('startsAt deve ser no futuro')
    }
    if (nextEndsAt && nextEndsAt <= nextStartsAt) {
      throw new ValidationError('endsAt deve ser depois de startsAt')
    }

    const updated = await this.repo.update(prisma, id, dto)
    log.info({ msg: 'event updated', eventId: id, fields: Object.keys(dto) })
    return updated
  }

  async remove(id: string, userId: string, log: Logger): Promise<void> {
    const event = await this.repo.findById(prisma, id)
    if (!event) throw new NotFoundError('Evento')
    this.assertOwner(event, userId)

    if (event.status !== EventStatus.DRAFT || event._count.tickets > 0) {
      throw new ConflictError(
        'EVENT_NOT_DELETABLE',
        'Só é possível remover eventos DRAFT sem ingressos vendidos',
      )
    }

    await this.repo.delete(prisma, id)
    log.info({ msg: 'event deleted', eventId: id })
  }

  async publish(id: string, userId: string, log: Logger) {
    const event = await this.repo.findById(prisma, id)
    if (!event) throw new NotFoundError('Evento')
    this.assertOwner(event, userId)
    assertTransition(EVENT_TRANSITIONS, event.status, EventStatus.PUBLISHED)

    if (event.startsAt.getTime() <= Date.now()) {
      throw new ConflictError('EVENT_STARTS_IN_PAST', 'Não é possível publicar um evento no passado')
    }

    const updated = await this.repo.update(prisma, id, { status: EventStatus.PUBLISHED })
    log.info({ msg: 'event published', eventId: id })
    return updated
  }

  async cancel(id: string, userId: string, log: Logger) {
    const event = await this.repo.findById(prisma, id)
    if (!event) throw new NotFoundError('Evento')
    this.assertOwner(event, userId)
    assertTransition(EVENT_TRANSITIONS, event.status, EventStatus.CANCELLED)

    const updated = await this.repo.update(prisma, id, { status: EventStatus.CANCELLED })
    log.info({ msg: 'event cancelled', eventId: id })
    return updated
  }

  async seatmap(id: string, requester: Requester | undefined): Promise<Seatmap> {
    const event = await this.repo.findById(prisma, id)
    if (!event || !this.isVisibleTo(event, requester)) throw new NotFoundError('Evento')

    const seats = await this.repo.seatmap(prisma, id)
    return buildSeatmap(event, seats)
  }

  // rascunho e cancelado só existem para o próprio organizador -- para qualquer outro
  // requisitante (inclusive anônimo) é como se o evento não existisse (§7.5)
  private isVisibleTo(event: { status: EventStatus; organizerId: string }, requester?: Requester): boolean {
    if (event.status === EventStatus.PUBLISHED) return true
    return requester?.id === event.organizerId
  }

  private assertOwner(event: { organizerId: string }, userId: string): void {
    if (event.organizerId !== userId) throw new ForbiddenError()
  }
}
