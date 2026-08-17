import type { PublicEvent } from './api'

export interface MovieGroup {
  key: string
  primary: PublicEvent
  sessionCount: number
}

function movieKey(event: PublicEvent): string {
  return `${event.source}|${event.externalId}`
}

export function groupEventsByMovie(events: PublicEvent[]): MovieGroup[] {
  const groups = new Map<string, MovieGroup>()
  for (const event of events) {
    const key = movieKey(event)
    const existing = groups.get(key)
    if (existing) existing.sessionCount += 1
    else groups.set(key, { key, primary: event, sessionCount: 1 })
  }
  return Array.from(groups.values())
}
