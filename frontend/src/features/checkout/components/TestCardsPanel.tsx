import { useState } from 'react'
import { env } from '../../../lib/env'
import styles from './TestCardsPanel.module.css'

interface TestCard {
  number: string
  outcome: string
}

const TEST_CARDS: TestCard[] = [
  { number: '4242 4242 4242 4242', outcome: 'aprovado' },
  { number: '4000 0000 0000 0002', outcome: 'recusado (cartão recusado)' },
  { number: '4000 0000 0000 9995', outcome: 'recusado (saldo insuficiente)' },
  { number: '4000 0025 0000 3155', outcome: 'exige autenticação adicional' },
]

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value.replace(/\s/g, ''))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard indisponível (ex.: contexto não seguro) -- o número já está
      // visível na tela pra copiar à mão, não precisa de tratamento de erro
    }
  }

  return (
    <button type="button" className={styles.copyButton} onClick={() => void handleCopy()}>
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  )
}

// Painel SEMPRE visível (§4.5, etapa 08) -- a banca precisa testar aprovação e
// recusa sem sair da aplicação nem ler documentação, então nunca fica atrás de um
// "?" ou accordion. Some sozinho com uma chave `pk_live_` -- trava simples contra
// vazar números de cartão de teste numa produção real por engano.
export function TestCardsPanel() {
  if (!env.VITE_STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_')) return null

  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>Cartões de teste (ambiente de simulação)</h2>
      <ul className={styles.list}>
        {TEST_CARDS.map((card) => (
          <li key={card.number} className={styles.row}>
            <span className={styles.number}>{card.number}</span>
            <span className={styles.outcome}>{card.outcome}</span>
            <CopyButton value={card.number} />
          </li>
        ))}
      </ul>
      <p className={styles.hint}>Validade e CVC: qualquer valor futuro / 3 dígitos.</p>
    </div>
  )
}
