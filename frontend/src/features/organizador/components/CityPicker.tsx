import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Select, useToast } from '../../../components'
import { getCities, organizadorKeys } from '../api'

interface CityPickerProps {
  uf: string
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
}

export function CityPicker({ uf, value, onChange, error, disabled }: CityPickerProps) {
  const { showToast } = useToast()
  const { data, isError, isFetching } = useQuery({
    queryKey: organizadorKeys.cities(uf),
    queryFn: () => getCities(uf),
    enabled: Boolean(uf),
    staleTime: Infinity,
  })

  useEffect(() => {
    if (isError) showToast('Não foi possível carregar as cidades. Tente de novo.', 'danger')
  }, [isError, showToast])

  const options = (data ?? []).map((city) => ({ value: city.nome, label: city.nome }))

  return (
    <Select
      label="Cidade"
      options={options}
      value={value}
      onValueChange={onChange}
      error={error}
      placeholder={uf ? 'Selecione' : 'Escolha o estado primeiro'}
      disabled={disabled || !uf || isFetching || options.length === 0}
    />
  )
}
