import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { sessionAttributeBadges } from '../../../shared/session-attributes'
import type { PublicEvent } from '../api'
import styles from './HeroCarousel.module.css'

interface HeroCarouselProps {
  events: PublicEvent[]
}

const AUTO_ADVANCE_MS = 6000
const SYNOPSIS_MAX_LENGTH = 160

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max).trimEnd()}…`
}

export function HeroCarousel({ events }: HeroCarouselProps) {
  const [index, setIndex] = useState(0)
  const count = events.length

  useEffect(() => {
    if (count <= 1) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % count)
    }, AUTO_ADVANCE_MS)
    return () => window.clearInterval(id)
  }, [count])

  if (count === 0) return null

  const safeIndex = index % count
  const event = events[safeIndex]!

  function goTo(next: number) {
    setIndex(((next % count) + count) % count)
  }

  return (
    <section className={styles.hero} aria-roledescription="carrossel" aria-label="Sessões em destaque">
      {event.imageUrl && <img src={event.imageUrl} alt="" className={styles.poster} />}
      <div className={styles.overlay}>
        <span className={styles.badge}>Em cartaz</span>
        <h2 className={styles.title}>{event.title}</h2>
        {event.synopsis && <p className={styles.synopsis}>{truncate(event.synopsis, SYNOPSIS_MAX_LENGTH)}</p>}
        <div className={styles.meta}>
          {sessionAttributeBadges(event).map((label) => (
            <span key={label} className={styles.metaBadge}>
              {label}
            </span>
          ))}
        </div>
        <Link to={`/eventos/${event.id}`} className={styles.cta}>
          Comprar ingressos
        </Link>
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowLeft}`}
            aria-label="Destaque anterior"
            onClick={() => goTo(safeIndex - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowRight}`}
            aria-label="Próximo destaque"
            onClick={() => goTo(safeIndex + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </button>
          <div className={styles.dots} role="tablist" aria-label="Selecionar destaque">
            {events.map((slide, slideIndex) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={slideIndex === safeIndex}
                aria-label={`Destaque ${slideIndex + 1} de ${count}: ${slide.title}`}
                className={[styles.dot, slideIndex === safeIndex ? styles.dotActive : null]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => goTo(slideIndex)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
