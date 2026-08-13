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

// Sem vínculo persistente operador<->evento nesta versão (README, §7.6) -- o
// operador escolhe a sessão do posto uma vez na UI, e é esse `eventId` que a
// validação envia. Reaproveita o catálogo público (mesma listagem que qualquer
// visitante vê) em vez de um endpoint próprio de portaria: não existe um.
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
    // formato/áudio/sala no rótulo -- ajuda o operador a distinguir duas sessões do
    // mesmo filme em horários diferentes (ex.: 19h 2D Dublado x 19h 3D Legendado VIP)
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
