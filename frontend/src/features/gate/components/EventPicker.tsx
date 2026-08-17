import { useQuery } from '@tanstack/react-query'
import { Select, Skeleton } from '../../../components'
import { catalogKeys, listPublicEvents } from '../../catalog/api'
import { formatEventDate } from '../../../shared/date'
import { sessionAttributeBadges } from '../../../shared/session-attributes'
import styles from './EventPicker.module.css'

interface EventPickerProps {
  value: string | null
  onChange: (eventId: string) => void
}

const PICKER_LIMIT = 100

export function EventPicker({ value, onChange }: EventPickerProps) {
  const { data, isLoading } = useQuery({
    queryKey: catalogKeys.list({ page: 1, limit: PICKER_LIMIT }),
    queryFn: () => listPublicEvents({ page: 1, limit: PICKER_LIMIT }),
  })

  if (isLoading) {
    return <Skeleton height="44px" radius="sm" className={styles.skeleton} />
  }

  const options = (data?.data ?? []).map((event) => ({
    value: event.id,
    label: `${event.title} - ${formatEventDate(event.startsAt, event.timezone)} (${sessionAttributeBadges(event).join(', ')})`,
  }))

  return (
    <Select
      label="Sessão deste posto"
      placeholder="Selecione a sessão"
      options={options}
      value={value ?? undefined}
      onValueChange={onChange}
    />
  )
}
