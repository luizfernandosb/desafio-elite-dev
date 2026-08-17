import { ageRatingColors } from '../shared/age-rating'
import styles from './EventCard.module.css'

interface EventCardProps {
  imageUrl?: string
  title: string
  ageRating?: string
  eager?: boolean
}

export function EventCard({ imageUrl, title, ageRating, eager = false }: EventCardProps) {
  return (
    <article className={styles.card}>
      {imageUrl && <img src={imageUrl} alt="" loading={eager ? 'eager' : 'lazy'} className={styles.poster} />}
      {ageRating && (
        <span className={styles.ageRating} style={ageRatingColors(ageRating)}>
          {ageRating}
        </span>
      )}
      <span className="sr-only">{title}</span>
    </article>
  )
}
