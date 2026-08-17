import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Select, useToast } from '../../../components'
import { getStates, organizadorKeys } from '../api'

interface StatePickerProps {
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
}

export function StatePicker({ value, onChange, error, disabled }: StatePickerProps) {
  const { showToast } = useToast()
  const { data, isError } = useQuery({
    queryKey: organizadorKeys.states(),
    queryFn: getStates,
    staleTime: Infinity,
  })

  useEffect(() => {
    if (isError) showToast('Não foi possível carregar os estados. Tente de novo.', 'danger')
  }, [isError, showToast])

  const options = (data ?? []).map((state) => ({ value: state.sigla, label: state.nome }))

  return (
    <Select
      label="Estado"
      options={options}
      value={value}
      onValueChange={onChange}
      error={error}
      disabled={disabled || options.length === 0}
    />
  )
}
