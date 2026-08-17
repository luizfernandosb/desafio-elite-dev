export type TicketPriceType = 'FULL' | 'HALF'

export function ticketPriceTypeLabel(priceType: TicketPriceType): string {
  return priceType === 'HALF' ? 'Meia-entrada' : 'Inteira'
}
