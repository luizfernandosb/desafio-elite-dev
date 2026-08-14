import { formatEventDate } from '../../shared/date'
import { formatMoney } from '../../shared/money'
import { sessionAttributeBadges } from '../../shared/session-attributes'
import type { PublicEvent } from './api'

// Mesma composição de card (subtítulo, local, preço, badge) usada em toda tela que
// lista sessões como `EventCard` -- grade completa (`EventList`) e o carrossel "Em
// cartaz" da home (`EventCarousel`) -- para a lógica não divergir em dois lugares.
export function eventCardProps(event: PublicEvent) {
  return {
    imageUrl: event.imageUrl,
    title: event.title,
    subtitle: formatEventDate(event.startsAt, event.timezone),
    meta: `${event.venueName} - ${event.venueCity}`,
    priceLabel: `A partir de ${formatMoney(event.effectivePriceInCents, event.currency)}`,
    badge: [event.genres[0], ...sessionAttributeBadges(event)].filter(Boolean).join(' · '),
  }
}
