import { SeatStatus } from '../../../generated/prisma/enums'
import type { Db } from '../../shared/db'

export class SeatStateRepository {
  markHeld(db: Db, seatIds: string[], expiresAt: Date) {
    return db.seatState.updateMany({
      where: { seatId: { in: seatIds } },
      data: { status: SeatStatus.HELD, expiresAt },
    })
  }

  markFree(db: Db, seatIds: string[]) {
    return db.seatState.updateMany({
      where: { seatId: { in: seatIds } },
      data: { status: SeatStatus.FREE, expiresAt: null },
    })
  }

  markSold(db: Db, seatIds: string[]) {
    return db.seatState.updateMany({
      where: { seatId: { in: seatIds } },
      data: { status: SeatStatus.SOLD, expiresAt: null },
    })
  }
}
