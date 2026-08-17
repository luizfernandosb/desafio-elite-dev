import { RoomType, TicketPriceType } from '../../../generated/prisma/enums'

export function computeEffectivePriceInCents(event: {
  priceInCents: number
  roomType: RoomType
  vipSurchargePercent: number | null
}): number {
  if (event.roomType !== RoomType.VIP || !event.vipSurchargePercent) return event.priceInCents
  return Math.round(event.priceInCents * (1 + event.vipSurchargePercent / 100))
}

export function computeSeatPriceInCents(effectivePriceInCents: number, priceType: TicketPriceType): number {
  return priceType === TicketPriceType.HALF ? Math.round(effectivePriceInCents / 2) : effectivePriceInCents
}
