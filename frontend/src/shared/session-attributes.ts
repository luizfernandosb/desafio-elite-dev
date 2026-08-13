// Formato/Áudio/Sala são o mesmo enum reusado em toda tela que mostra uma sessão
// (organizador, catálogo, ingresso, portaria) -- diferente de `status.ts`, que cada
// feature duplica porque cada domínio tem um enum de status diferente, aqui é
// exatamente o mesmo valor em todo lugar, então mora num único módulo compartilhado.
export type SessionFormat = 'TWO_D' | 'THREE_D'
export type SessionAudio = 'DUBBED' | 'SUBTITLED'
export type SessionRoomType = 'STANDARD' | 'VIP'

interface AttributeOption<T extends string> {
  value: T
  label: string
}

export const FORMAT_OPTIONS: AttributeOption<SessionFormat>[] = [
  { value: 'TWO_D', label: '2D' },
  { value: 'THREE_D', label: '3D' },
]

export const AUDIO_OPTIONS: AttributeOption<SessionAudio>[] = [
  { value: 'DUBBED', label: 'Dublado' },
  { value: 'SUBTITLED', label: 'Legendado' },
]

export const ROOM_TYPE_OPTIONS: AttributeOption<SessionRoomType>[] = [
  { value: 'STANDARD', label: 'Padrão' },
  { value: 'VIP', label: 'VIP' },
]

export function formatLabel(format: SessionFormat): string {
  return FORMAT_OPTIONS.find((option) => option.value === format)?.label ?? format
}

export function audioLabel(audio: SessionAudio): string {
  return AUDIO_OPTIONS.find((option) => option.value === audio)?.label ?? audio
}

export function roomTypeLabel(roomType: SessionRoomType): string {
  return ROOM_TYPE_OPTIONS.find((option) => option.value === roomType)?.label ?? roomType
}

// Rótulos prontos pra virar `<Badge>` -- formato e áudio sempre aparecem (2D/Dublado
// são o padrão, mas ainda é informação real); "Sala VIP" só aparece quando é VIP,
// "Padrão" não é um badge (não é informação nova, só ruído ao lado dos outros dois).
export function sessionAttributeBadges(event: {
  format: SessionFormat
  audio: SessionAudio
  roomType: SessionRoomType
}): string[] {
  const badges = [formatLabel(event.format), audioLabel(event.audio)]
  if (event.roomType === 'VIP') badges.push('Sala VIP')
  return badges
}
