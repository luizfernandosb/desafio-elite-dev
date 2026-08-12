import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, EmptyState, Input, Skeleton } from '../../../components'
import { catalogErrorMessage } from '../error-messages'
import { organizadorKeys, searchCatalog, type CatalogItem } from '../api'
import { useDebouncedValue } from '../../../shared/useDebouncedValue'
import styles from './MovieSearch.module.css'

interface MovieSearchProps {
  selected: CatalogItem | null
  onSelect: (item: CatalogItem | null) => void
}

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 400 // TMDb tem rate limit e o back cacheia por 10 min (§4.3)

export function MovieSearch({ selected, onSelect }: MovieSearchProps) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS)
  const trimmed = debouncedQuery.trim()
  const enabled = trimmed.length >= MIN_QUERY_LENGTH

  const { data, isLoading, isError, error } = useQuery({
    queryKey: organizadorKeys.catalogSearch(trimmed, 1),
    queryFn: () => searchCatalog(trimmed, 1),
    enabled,
  })

  if (selected) {
    return (
      <div className={styles.selected}>
        <Card>
          <div className={styles.selectedContent}>
            {selected.imageUrl ? (
              <img src={selected.imageUrl} alt="" className={styles.poster} />
            ) : (
              <div className={styles.posterFallback} aria-hidden="true" />
            )}
            <div>
              <h3 className={styles.selectedTitle}>{selected.title}</h3>
              {selected.subtitle && <p className={styles.subtitle}>{selected.subtitle}</p>}
              {/* o back grava snapshot da sessão (§4.3) -- a UI diz isso em uma linha,
                  não deixa o organizador supor que trocar o filme no TMDb depois muda algo aqui */}
              <p className={styles.note}>Os dados do filme são copiados para a sessão e não mudam depois.</p>
            </div>
          </div>
        </Card>
        <button type="button" className={styles.change} onClick={() => onSelect(null)}>
          Trocar filme
        </button>
      </div>
    )
  }

  return (
    <div className={styles.search}>
      <Input
        label="Buscar filme"
        placeholder="Ex.: Duna"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        hint="Digite ao menos 2 letras"
      />

      {enabled && isLoading && (
        <div className={styles.grid} aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} height="220px" radius="md" />
          ))}
        </div>
      )}

      {enabled && isError && (
        <p role="alert" className={styles.error}>
          {catalogErrorMessage(error)}
        </p>
      )}

      {enabled && !isLoading && !isError && data && data.data.length === 0 && (
        <EmptyState
          title={`Nenhum filme encontrado para "${trimmed}"`}
          description="Tente refinar a busca com outro título."
        />
      )}

      {enabled && !isLoading && !isError && data && data.data.length > 0 && (
        <div className={styles.grid}>
          {data.data.map((item) => (
            <Card key={`${item.source}:${item.externalId}`} interactive className={styles.result}>
              <button type="button" className={styles.resultButton} onClick={() => onSelect(item)}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className={styles.poster} />
                ) : (
                  <div className={styles.posterFallback} aria-hidden="true" />
                )}
                <span className={styles.resultTitle}>{item.title}</span>
                {item.subtitle && <span className={styles.resultSubtitle}>{item.subtitle}</span>}
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
