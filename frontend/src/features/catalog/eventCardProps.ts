import type { PublicEvent } from './api'

// Mesma composição de card (pôster + classificação, sem mais nada sobreposto)
// usada em toda tela que lista sessões como `EventCard` -- hoje só o carrossel
// "Em cartaz" da home (`EventCarousel`), mas extraído à parte para não duplicar a
// lógica se outra tela voltar a precisar do mesmo card.
export function eventCardProps(event: PublicEvent) {
  return {
    imageUrl: event.imageUrl,
    title: event.title,
    ageRating: event.ageRating,
  }
}
