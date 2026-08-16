-- Cancelamento de ingresso (devolução de assento ao estoque) precisa que um
-- Ticket CANCELLED pare de ocupar a unicidade de (eventId, seatId) -- senão o
-- mesmo assento nunca mais pode ser vendido depois de cancelado uma vez, mesmo
-- com o SeatState de volta a FREE. O índice original (20260811193630) não
-- filtrava por status porque cancelamento ainda não existia.

DROP INDEX "ticket_seat_unique";

-- Só UM ingresso ATIVO por assento naquele evento -- ingressos CANCELLED (ou,
-- no futuro, qualquer outro status que não conte como "ocupando o lugar") não
-- entram na unicidade.
CREATE UNIQUE INDEX "ticket_seat_unique"
  ON "Ticket" ("eventId", "seatId")
  WHERE "seatId" IS NOT NULL AND "status" = 'ACTIVE';
