import type { TicketPriceType } from '../../shared/ticket-price-type'

// Mirror de `computeSeatPriceInCents` do back (events/pricing.ts) -- meia-entrada é
// 50% do preço EFETIVO do assento (já com adicional de Sala VIP, se houver). Usado
// só para a barra de seleção mostrar o total real antes de reservar; o valor
// cobrado de verdade é sempre recalculado no servidor na criação do pedido.
export function computeSeatPriceInCents(effectivePriceInCents: number, priceType: TicketPriceType): number {
  return priceType === 'HALF' ? Math.round(effectivePriceInCents / 2) : effectivePriceInCents
}
