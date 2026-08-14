// Meia-entrada é o mesmo enum reusado em toda tela que decide ou mostra o tipo de
// ingresso comprado (mapa de assentos, meus ingressos, compartilhamento) -- mesmo
// vocabulário do back (`TicketPriceType`, schema.prisma), mesmo raciocínio de
// `session-attributes.ts` para não duplicar o enum por feature.
export type TicketPriceType = 'FULL' | 'HALF'

export function ticketPriceTypeLabel(priceType: TicketPriceType): string {
  return priceType === 'HALF' ? 'Meia-entrada' : 'Inteira'
}
