import { RoomType, TicketPriceType } from '../../../generated/prisma/enums'

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

// Meia-entrada: 50% do preço EFETIVO do assento (já com o adicional de Sala VIP, se
// houver) -- nunca 50% do preço base. Único lugar que sabe essa conta, mesmo padrão
// de `computeEffectivePriceInCents`.
export function computeSeatPriceInCents(effectivePriceInCents: number, priceType: TicketPriceType): number {
  return priceType === TicketPriceType.HALF ? Math.round(effectivePriceInCents / 2) : effectivePriceInCents
}
