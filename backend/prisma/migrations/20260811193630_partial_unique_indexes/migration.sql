-- Índices parciais únicos -- o Prisma não os expressa em schema.prisma (§4.4.1).
-- São a garantia de anti-double-booking (BE-4): o banco recusa a segunda escrita
-- antes de qualquer lógica de aplicação decidir algo.

-- Só UMA reserva ativa por assento.
CREATE UNIQUE INDEX "seat_hold_active"
  ON "SeatHold" ("seatId")
  WHERE "releasedAt" IS NULL;

-- Só UM ingresso por assento naquele evento.
CREATE UNIQUE INDEX "ticket_seat_unique"
  ON "Ticket" ("eventId", "seatId")
  WHERE "seatId" IS NOT NULL;
