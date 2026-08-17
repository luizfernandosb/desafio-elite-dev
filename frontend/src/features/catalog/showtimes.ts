import { dayTabLabel, toEventDateKey } from '../../shared/date'
import { audioLabel, formatLabel, type SessionAudio, type SessionFormat } from '../../shared/session-attributes'
import type { PublicEvent } from './api'

export interface DayTab {
  key: string
  label: string
  shortDate: string
}

export interface ShowtimeGroup {
  key: string
  label: string
  sessions: PublicEvent[]
}

export interface ShowtimesByDay {
  dayTabs: DayTab[]
  groupsByDay: Map<string, ShowtimeGroup[]>
}

const AUDIO_ORDER: SessionAudio[] = ['DUBBED', 'SUBTITLED']
const FORMAT_ORDER: SessionFormat[] = ['TWO_D', 'THREE_D']

function groupKey(session: PublicEvent): string {
  return `${session.audio}|${session.format}|${session.roomType}`
}

function groupLabel(session: PublicEvent): string {
  const base = `${audioLabel(session.audio)} - ${formatLabel(session.format)}`
  return session.roomType === 'VIP' ? `${base} - Sala VIP` : base
}

function groupSortIndex(session: PublicEvent): number {
  const audioIndex = AUDIO_ORDER.indexOf(session.audio)
  const formatIndex = FORMAT_ORDER.indexOf(session.format)
  const vipIndex = session.roomType === 'VIP' ? 1 : 0
  return audioIndex * 100 + formatIndex * 10 + vipIndex
}

export function buildShowtimesByDay(sessions: PublicEvent[], timezone: string, now: Date = new Date()): ShowtimesByDay {
  const upcoming = sessions.filter((session) => new Date(session.startsAt).getTime() > now.getTime())

  const dayKeys = new Set<string>([toEventDateKey(now, timezone)])
  for (const session of upcoming) dayKeys.add(toEventDateKey(session.startsAt, timezone))

  const sortedDayKeys = Array.from(dayKeys).sort()
  const dayTabs: DayTab[] = sortedDayKeys.map((key) => ({ key, ...dayTabLabel(key, timezone, now) }))

  const groupsByDay = new Map<string, ShowtimeGroup[]>()
  for (const dayKey of sortedDayKeys) {
    const sessionsForDay = upcoming
      .filter((session) => toEventDateKey(session.startsAt, timezone) === dayKey)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

    const groupsMap = new Map<string, ShowtimeGroup>()
    for (const session of sessionsForDay) {
      const key = groupKey(session)
      const existing = groupsMap.get(key)
      if (existing) existing.sessions.push(session)
      else groupsMap.set(key, { key, label: groupLabel(session), sessions: [session] })
    }

    const groups = Array.from(groupsMap.values()).sort(
      (a, b) => groupSortIndex(a.sessions[0]!) - groupSortIndex(b.sessions[0]!),
    )
    groupsByDay.set(dayKey, groups)
  }

  return { dayTabs, groupsByDay }
}

export function defaultDayTabKey(
  dayTabs: DayTab[],
  groupsByDay: Map<string, ShowtimeGroup[]>,
  preferredKey?: string,
): string {
  if (preferredKey && dayTabs.some((tab) => tab.key === preferredKey)) return preferredKey
  const firstWithSessions = dayTabs.find((tab) => (groupsByDay.get(tab.key)?.length ?? 0) > 0)
  return (firstWithSessions ?? dayTabs[0])?.key ?? ''
}
