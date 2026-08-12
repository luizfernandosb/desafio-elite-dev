import { useSearchParams } from 'react-router-dom'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { EventList } from '../components/EventList'
import { SearchBar } from '../components/SearchBar'
import styles from './CatalogPage.module.css'

// Estado de busca/filtro inteiro na URL (não só `?q=`) -- um link colado ou um F5
// reproduz exatamente a mesma tela (§ etapa 05, "resultado é compartilhável e
// sobrevive a F5"). Filtrar usa `replace: true` -- não deveria empilhar uma entrada
// de histórico por tecla/clique; paginar usa o push normal, então o botão "voltar"
// do navegador desfolha página a página, não filtro a filtro.
export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const page = Number(searchParams.get('page') ?? '1') || 1

  function handleSearchCommit(value: string) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (value) params.set('q', value)
        else params.delete('q')
        params.delete('page') // busca nova -- volta para a primeira página
        return params
      },
      { replace: true },
    )
  }

  function handleDateRangeChange(range: { from: string; to: string }) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (range.from) params.set('from', range.from)
        else params.delete('from')
        if (range.to) params.set('to', range.to)
        else params.delete('to')
        params.delete('page')
        return params
      },
      { replace: true },
    )
  }

  function handlePageChange(nextPage: number) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      params.set('page', String(nextPage))
      return params
    })
  }

  function handleClearFilters() {
    setSearchParams({}, { replace: true })
  }

  return (
    <div className={styles.page}>
      <h1>Catálogo</h1>
      <div className={styles.filters}>
        <SearchBar value={q} onCommit={handleSearchCommit} />
        <DateRangeFilter from={from} to={to} onChange={handleDateRangeChange} />
      </div>
      <EventList
        q={q}
        from={from}
        to={to}
        page={page}
        onPageChange={handlePageChange}
        onClearFilters={handleClearFilters}
      />
    </div>
  )
}
