import { Button } from '../../../../components'
import { MovieSearch } from '../../components/MovieSearch'
import type { CatalogItem } from '../../api'
import styles from './steps.module.css'

interface MovieStepProps {
  selected: CatalogItem | null
  onSelect: (item: CatalogItem | null) => void
  onNext: () => void
}

export function MovieStep({ selected, onSelect, onNext }: MovieStepProps) {
  return (
    <div className={styles.step}>
      <h2>Que filme?</h2>
      <MovieSearch selected={selected} onSelect={onSelect} />
      <div className={styles.actions}>
        <Button onClick={onNext} disabled={!selected}>
          Continuar
        </Button>
      </div>
    </div>
  )
}
