import { Link } from 'react-router-dom'
import { Badge, EventCard } from '../../../components'
import { formatEventDate } from '../../../shared/date'
import { formatMoney } from '../../../shared/money'
import { sessionAttributeBadges } from '../../../shared/session-attributes'
import type { PublicEvent } from '../api'
import styles from './SearchResultCard.module.css'

interface SearchResultCardProps {
  event: PublicEvent
  // total de sessões deste MESMO filme (§ groupByMovie.ts) -- `event` aqui é só a
  // mais próxima delas. > 1 mostra "+N horários" em vez de fingir que só existe
  // esta sessão; a lista completa (dia/formato/sala) mora em `EventDetailPage`.
  sessionCount?: number
  eager?: boolean
}

// Linha de resultado de busca -- pôster intocado (mesma composição do EventCard da
// home: só pôster + selo de classificação, "informação demais no pôster" já foi
// descartado ali) e a legenda AO LADO, nunca sobreposta. Data, local e preço, que o
// desafio pede na navegação/busca, moram nesta faixa de texto normal, não num
// gradiente por cima da imagem.
export function SearchResultCard({ event, sessionCount = 1, eager = false }: SearchResultCardProps) {
  const badges = [event.genres[0], ...sessionAttributeBadges(event)].filter(Boolean) as string[]
  const hasMoreSessions = sessionCount > 1

  return (
    <Link to={`/eventos/${event.id}`} className={styles.card}>
      {/* `aria-hidden`: o pôster é puramente decorativo aqui (`alt=""`) e o
          `sr-only` que o EventCard carrega junto (necessário quando ele aparece
          sozinho no carrossel) ficaria duplicado no nome acessível do link -- o
          `<h3>` ao lado já dá o nome, sem repetição para quem usa leitor de tela. */}
      <div className={styles.poster} aria-hidden="true">
        <EventCard imageUrl={event.imageUrl} title={event.title} ageRating={event.ageRating} eager={eager} />
      </div>
      <div className={styles.info}>
        <h3 className={styles.title}>{event.title}</h3>
        <p className={styles.date}>
          {hasMoreSessions ? 'Próxima sessão: ' : ''}
          {formatEventDate(event.startsAt, event.timezone)}
        </p>
        <p className={styles.venue}>
          {event.venueName} · {event.venueCity}
        </p>
        {badges.length > 0 && (
          <div className={styles.badges}>
            {badges.map((badge) => (
              <Badge key={badge}>{badge}</Badge>
            ))}
          </div>
        )}
        <div className={styles.footer}>
          <p className={styles.price}>{formatMoney(event.effectivePriceInCents, event.currency)}</p>
          {hasMoreSessions && (
            <p className={styles.moreSessions}>+{sessionCount - 1} horário{sessionCount > 2 ? 's' : ''}</p>
          )}
        </div>
      </div>
    </Link>
  )
}
