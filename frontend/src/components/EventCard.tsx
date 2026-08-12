import type { ReactNode } from 'react'
import styles from './EventCard.module.css'

interface EventCardProps {
  imageUrl?: string // ausente é legítimo -- nem todo item do catálogo tem pôster (§4.3)
  title: string
  subtitle?: string
  // segunda linha secundária, abaixo de `subtitle` (etapa 05: card precisa mostrar
  // data E local/cidade, não só um dos dois -- `subtitle` vira a data, `meta` o local)
  meta?: string
  priceLabel: string // já formatado (formatMoney) -- este componente não formata dinheiro
  badge?: ReactNode
  // `false` (default) = `loading="lazy"` -- card fora da primeira dobra de uma grade
  // (etapa 05, critério de Lighthouse). Cards da primeira dobra passam `eager` para
  // não atrasar o LCP por causa do atributo.
  eager?: boolean
}

// Pôster como fundo, overlay escuro só na parte inferior (onde o texto entra) -- não
// na imagem inteira: overlay total apaga o pôster, que é o que dá identidade à
// sessão (§5.1.1). Preço em --primary, peso 700, sempre visível sem hover.
//
// `<img loading="lazy">` real, não `background-image` inline -- CSS background não
// tem equivalente ao atributo `loading` do navegador (§ etapa 05, critério de
// Lighthouse "poucas imagens grandes, loading=lazy fora da primeira dobra"). O pôster
// fica absolutamente posicionado atrás do overlay, mesma composição visual de antes.
export function EventCard({ imageUrl, title, subtitle, meta, priceLabel, badge, eager = false }: EventCardProps) {
  return (
    <article className={styles.card}>
      {/* sem imageUrl: fundo cai no `background-color` de `.card`, sem <img> quebrado */}
      {imageUrl && <img src={imageUrl} alt="" loading={eager ? 'eager' : 'lazy'} className={styles.poster} />}
      <div className={styles.overlay}>
        {badge && <div className={styles.badge}>{badge}</div>}
        <p className={styles.price}>{priceLabel}</p>
        <h3 className={styles.title}>{title}</h3>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        {meta && <p className={styles.meta}>{meta}</p>}
      </div>
    </article>
  )
}
