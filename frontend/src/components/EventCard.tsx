import styles from './EventCard.module.css'

interface EventCardProps {
  imageUrl: string
  title: string
  subtitle?: string
  priceLabel: string // já formatado (formatMoney) -- este componente não formata dinheiro
}

// Pôster como fundo, overlay escuro só na parte inferior (onde o texto entra) -- não
// na imagem inteira: overlay total apaga o pôster, que é o que dá identidade à
// sessão (§5.1.1). Preço em --primary, peso 700, sempre visível sem hover.
export function EventCard({ imageUrl, title, subtitle, priceLabel }: EventCardProps) {
  return (
    <article className={styles.card} style={{ backgroundImage: `url(${imageUrl})` }}>
      <div className={styles.overlay}>
        <p className={styles.price}>{priceLabel}</p>
        <h3 className={styles.title}>{title}</h3>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
    </article>
  )
}
