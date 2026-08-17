import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { formatEventTime } from '../../../shared/date'
import type { DayTab, ShowtimeGroup } from '../showtimes'
import styles from './ShowtimePicker.module.css'

interface ShowtimePickerProps {
  dayTabs: DayTab[]
  groupsByDay: Map<string, ShowtimeGroup[]>
  selectedDayKey: string
  onSelectDay: (key: string) => void
  hrefForSession: (sessionId: string) => string
}

export function ShowtimePicker({ dayTabs, groupsByDay, selectedDayKey, onSelectDay, hrefForSession }: ShowtimePickerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)

  function scrollBy(amount: number) {
    scrollerRef.current?.scrollBy({ left: amount, behavior: 'smooth' })
  }

  const groups = groupsByDay.get(selectedDayKey) ?? []

  return (
    <div className={styles.picker}>
      <div className={styles.dayRow}>
        <button type="button" className={styles.arrow} aria-label="Dias anteriores" onClick={() => scrollBy(-208)}>
          ‹
        </button>
        <div className={styles.dayScroller} ref={scrollerRef} role="tablist" aria-label="Escolha o dia">
          {dayTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={tab.key === selectedDayKey}
              className={[styles.dayTab, tab.key === selectedDayKey ? styles.dayTabActive : null]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectDay(tab.key)}
            >
              <span className={styles.dayLabel}>{tab.label}</span>
              <span className={styles.dayDate}>{tab.shortDate}</span>
            </button>
          ))}
        </div>
        <button type="button" className={styles.arrow} aria-label="Próximos dias" onClick={() => scrollBy(208)}>
          ›
        </button>
      </div>

      {groups.length === 0 ? (
        <p className={styles.empty}>Nenhuma sessão neste dia.</p>
      ) : (
        <div className={styles.groups}>
          {groups.map((group) => (
            <div key={group.key}>
              <p className={styles.groupLabel}>{group.label}</p>
              <div className={styles.sessionRow}>
                {group.sessions.map((session) => (
                  <Link
                    key={session.id}
                    to={hrefForSession(session.id)}
                    className={styles.sessionButton}
                    aria-label={`Escolher assentos - ${session.venueName}, ${formatEventTime(session.startsAt, session.timezone)}`}
                  >
                    <span className={styles.venue}>{session.venueName}</span>
                    <span className={styles.time}>{formatEventTime(session.startsAt, session.timezone)}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
