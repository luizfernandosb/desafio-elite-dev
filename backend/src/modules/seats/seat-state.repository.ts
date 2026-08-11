import { SeatStatus } from '../../../generated/prisma/enums'
import type { Db } from '../../shared/db'

// projeção de leitura (§4.4.2) -- escrita aqui mantém `seat_state` em sincronia com
// SeatHold na mesma transação. A etapa 11 decide entre isto e trigger no Postgres.
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
}
