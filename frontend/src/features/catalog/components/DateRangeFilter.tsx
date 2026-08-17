import { Input } from '../../../components'
import styles from './DateRangeFilter.module.css'

interface DateRangeFilterProps {
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
}

export function DateRangeFilter({ from, to, onChange }: DateRangeFilterProps) {
  return (
    <div className={styles.row}>
      <Input
        label="De"
        type="date"
        value={from}
        onChange={(event) => onChange({ from: event.target.value, to })}
      />
      <Input label="Até" type="date" value={to} onChange={(event) => onChange({ from, to: event.target.value })} />
    </div>
  )
}
