import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  EventCard,
  Input,
  Select,
  Skeleton,
  Spinner,
  Tabs,
  Textarea,
  useToast,
} from '../../components'
import styles from './StyleGuidePage.module.css'

const COLOR_TOKENS = [
  '--primary',
  '--primary-hover',
  '--primary-light',
  '--primary-dark',
  '--primary-tint',
  '--success',
  '--danger',
  '--warning',
  '--neutral-gate',
]

const GENRE_OPTIONS = [
  { value: 'acao', label: 'Ação' },
  { value: 'drama', label: 'Drama' },
  { value: 'comedia', label: 'Comédia' },
]

// Conferência visual dos tokens e dos 12 componentes base -- substitui Storybook
// (§ etapa 02, custo alto para o prazo). Só em desenvolvimento: excluída do bundle
// de produção via `import.meta.env.DEV` em router.tsx, ninguém navega pra cá.
export default function StyleGuidePage() {
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  return (
    <div className={styles.page}>
      <h1>Guia de estilo</h1>
      <p>Página de desenvolvimento - conferência visual dos tokens e componentes (etapa 02).</p>

      <section className={styles.section}>
        <h2>Cores</h2>
        <div className={styles.swatches}>
          {COLOR_TOKENS.map((token) => (
            <div key={token} className={styles.swatch}>
              <div className={styles.swatchColor} style={{ background: `var(${token})` }} />
              <code>{token}</code>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Tipografia</h2>
        <p className="text-display">Display</p>
        <h1>H1 - título de página</h1>
        <h2>H2 - título de card</h2>
        <h3>H3 - subtítulo</h3>
        <p className="text-body">Body - texto corrido, descrição de evento e demais parágrafos.</p>
        <p className="text-small">Small - metadados, datas, locais.</p>
        <p className="text-caption">Caption - labels em uppercase</p>
        <p className="tabular-nums">Tabular nums: R$ 32,00 - 09m 45s - assento A12</p>
      </section>

      <section className={styles.section}>
        <h2>Button</h2>
        <div className={styles.row}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="primary" loading={loading} onClick={() => setLoading(true)}>
            {loading ? 'Carregando' : 'Simular loading'}
          </Button>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Input / Textarea</h2>
        <div className={styles.column}>
          <Input label="E-mail" placeholder="voce@exemplo.com" />
          <Input label="Senha" type="password" error="Senha deve ter ao menos 10 caracteres" />
          <Input label="Cidade" hint="Onde o evento acontece" />
          <Textarea label="Sinopse" placeholder="Descrição do evento" />
        </div>
      </section>

      <section className={styles.section}>
        <h2>Select</h2>
        <Select label="Gênero" options={GENRE_OPTIONS} placeholder="Escolha um gênero" />
      </section>

      <section className={styles.section}>
        <h2>Tabs</h2>
        <Tabs
          label="Exemplo de abas"
          items={[
            { value: 'a', label: 'Sobre', content: <p className="text-body">Conteúdo da aba Sobre.</p> },
            { value: 'b', label: 'Local', content: <p className="text-body">Conteúdo da aba Local.</p> },
          ]}
        />
      </section>

      <section className={styles.section}>
        <h2>Dialog</h2>
        <Dialog
          trigger={<Button variant="secondary">Abrir dialog</Button>}
          title="Confirmar ação"
          description="Foco preso, Esc fecha, foco volta ao gatilho - comportamento do Radix."
        >
          <Button variant="primary">Confirmar</Button>
        </Dialog>
      </section>

      <section className={styles.section}>
        <h2>Toast</h2>
        <div className={styles.row}>
          <Button variant="secondary" onClick={() => showToast('Notificação padrão')}>
            Padrão
          </Button>
          <Button variant="secondary" onClick={() => showToast('Pagamento aprovado', 'success')}>
            Sucesso
          </Button>
          <Button variant="secondary" onClick={() => showToast('Falha ao processar', 'danger')}>
            Erro
          </Button>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Card / EventCard / Badge</h2>
        <div className={styles.row}>
          <Card interactive>
            <h3>Card genérico</h3>
            <p className="text-body">Superfície, borda e raio padrão.</p>
            <Badge>Ficção científica</Badge>
          </Card>
          <div className={styles.eventCardWrapper}>
            <EventCard
              imageUrl="https://image.tmdb.org/t/p/w500/duna-parte-dois.jpg"
              title="Duna: Parte Dois"
              subtitle="Cine Elite - Sala 1"
              priceLabel="R$ 32,00"
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2>EmptyState</h2>
        <EmptyState title="Nenhum evento encontrado" description="Ajuste os filtros e tente de novo." />
      </section>

      <section className={styles.section}>
        <h2>Skeleton / Spinner</h2>
        <div className={styles.column}>
          <Skeleton height="1.5rem" width="60%" />
          <Skeleton height="1rem" width="80%" />
        </div>
        <div className={styles.row}>
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </div>
      </section>
    </div>
  )
}
