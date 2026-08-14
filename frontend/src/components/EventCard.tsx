import { ageRatingColors } from '../shared/age-rating'
import styles from './EventCard.module.css'

interface EventCardProps {
  imageUrl?: string // ausente é legítimo -- nem todo item do catálogo tem pôster (§4.3)
  title: string
  // classificação indicativa BR ("L", "10", "12", "14", "16", "18") -- ausente
  // quando o TMDb não tinha essa entrada para o filme (§ tmdb.provider.ts)
  ageRating?: string
  // `false` (default) = `loading="lazy"` -- card fora da primeira dobra de uma grade
  // (etapa 05, critério de Lighthouse). Cards da primeira dobra passam `eager` para
  // não atrasar o LCP por causa do atributo.
  eager?: boolean
}

// Só pôster + selo de classificação -- de propósito (pedido do usuário: "informação
// demais no poster"). Nada de título/data/local/preço sobrepostos. O título
// continua no DOM como texto oculto (`sr-only`, tokens.css) -- sem isso o card (e o
// `<Link>` que o envolve em EventCarousel) fica sem nome acessível para leitor de
// tela, já que não sobra nenhum texto visível para computar um.
export function EventCard({ imageUrl, title, ageRating, eager = false }: EventCardProps) {
  return (
    <article className={styles.card}>
      {/* sem imageUrl: fundo cai no `background-color` de `.card`, sem <img> quebrado */}
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
