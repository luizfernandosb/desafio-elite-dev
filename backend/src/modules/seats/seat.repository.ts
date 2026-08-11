import type { Db } from '../../shared/db'

export class SeatRepository {
  countInEvent(db: Db, eventId: string, seatIds: string[]) {
    return db.seat.count({ where: { id: { in: seatIds }, eventId } })
  }
}
