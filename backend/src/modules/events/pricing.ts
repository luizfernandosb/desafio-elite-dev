import { RoomType } from '../../../generated/prisma/enums'

// Único lugar que sabe transformar preço base em preço de verdade -- toda tela que
// precisa saber quanto o cliente paga (catálogo, seatmap, carrinho, cobrança) lê
// `effectivePriceInCents` já calculado, nunca reimplementa esta conta.
export function computeEffectivePriceInCents(event: {
  priceInCents: number
  roomType: RoomType
  vipSurchargePercent: number | null
}): number {
  if (event.roomType !== RoomType.VIP || !event.vipSurchargePercent) return event.priceInCents
  return Math.round(event.priceInCents * (1 + event.vipSurchargePercent / 100))
}
