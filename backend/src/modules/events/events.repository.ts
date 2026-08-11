import type {
  EventUncheckedCreateInput,
  EventUpdateInput,
  EventWhereInput,
  SeatCreateManyInput,
  SeatStateCreateManyInput,
} from '../../../generated/prisma/models'
import type { Db } from '../../shared/db'

const ORGANIZER_SELECT = { select: { id: true, name: true } }
const TICKETS_COUNT = { select: { tickets: true } }

export class EventsRepository {
  create(db: Db, data: EventUncheckedCreateInput) {
    return db.event.create({ data })
  }

  createSeats(db: Db, seats: SeatCreateManyInput[]) {
    return db.seat.createMany({ data: seats })
  }

  createSeatStates(db: Db, states: SeatStateCreateManyInput[]) {
    return db.seatState.createMany({ data: states })
  }

  findById(db: Db, id: string) {
    return db.event.findUnique({
      where: { id },
      include: { organizer: ORGANIZER_SELECT, _count: TICKETS_COUNT },
    })
  }

  async findMany(db: Db, where: EventWhereInput, skip: number, take: number) {
    const [data, total] = await Promise.all([
      db.event.findMany({
        where,
        orderBy: { startsAt: 'asc' },
        skip,
        take,
        include: { organizer: ORGANIZER_SELECT, _count: TICKETS_COUNT },
      }),
      db.event.count({ where }),
    ])
    return { data, total }
  }

  update(db: Db, id: string, data: EventUpdateInput) {
    return db.event.update({ where: { id }, data })
  }

  delete(db: Db, id: string) {
    return db.event.delete({ where: { id } })
  }

  countTickets(db: Db, eventId: string) {
    return db.ticket.count({ where: { eventId } })
  }

  seatmap(db: Db, eventId: string) {
    return db.seat.findMany({
      where: { eventId },
      orderBy: [{ row: 'asc' }, { number: 'asc' }],
      include: { state: true },
    })
  }
}
