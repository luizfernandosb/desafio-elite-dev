import type { PublicEvent } from './api'

export function eventCardProps(event: PublicEvent) {
  return {
    imageUrl: event.imageUrl,
    title: event.title,
    ageRating: event.ageRating,
  }
}
