import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EventCard } from '../../../components'
import type { PublicEvent } from '../api'
import { eventCardProps } from '../eventCardProps'
import styles from './EventCarousel.module.css'

interface EventCarouselProps {
  title: string
  events: PublicEvent[]
}

const SCROLL_AMOUNT = 640

// Mesmo mecanismo de scroll horizontal com setas do `ShowtimePicker` (dia da
// sessão) -- aqui aplicado a uma fileira de `EventCard` em vez de abas de dia.
export function EventCarousel({ title, events }: EventCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)

  function scrollBy(amount: number) {
    scrollerRef.current?.scrollBy({ left: amount, behavior: 'smooth' })
  }

  if (events.length === 0) return null

  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.arrow}
          aria-label="Sessões anteriores"
          onClick={() => scrollBy(-SCROLL_AMOUNT)}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <div className={styles.scroller} ref={scrollerRef}>
          {events.map((event) => (
            <Link key={event.id} to={`/eventos/${event.id}`} className={styles.cardLink}>
              <EventCard {...eventCardProps(event)} />
            </Link>
          ))}
        </div>
        <button
          type="button"
          className={styles.arrow}
          aria-label="Próximas sessões"
          onClick={() => scrollBy(SCROLL_AMOUNT)}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
