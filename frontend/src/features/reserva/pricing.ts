import type { TicketPriceType } from '../../shared/ticket-price-type'

export function computeSeatPriceInCents(effectivePriceInCents: number, priceType: TicketPriceType): number {
  return priceType === 'HALF' ? Math.round(effectivePriceInCents / 2) : effectivePriceInCents
}
