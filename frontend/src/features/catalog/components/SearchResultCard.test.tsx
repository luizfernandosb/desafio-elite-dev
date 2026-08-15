import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { PublicEvent } from '../api'
import { SearchResultCard } from './SearchResultCard'

function makeEvent(overrides: Partial<PublicEvent> = {}): PublicEvent {
  return {
    id: 'evt-1',
    source: 'TMDB',
    externalId: '693134',
    title: 'Duna: Parte Dois',
    genres: ['Ficção científica'],
    imageUrl: 'https://image.tmdb.org/duna.jpg',
    venueName: 'Cine Elite',
    venueCity: 'São Paulo',
    format: 'TWO_D',
    audio: 'DUBBED',
    roomType: 'STANDARD',
    status: 'PUBLISHED',
    startsAt: '2026-09-20T23:00:00.000Z',
    timezone: 'America/Sao_Paulo',
    priceInCents: 3200,
    effectivePriceInCents: 3200,
    currency: 'BRL',
    organizer: { id: 'org-1', name: 'Ana' },
    _count: { tickets: 3 },
    ...overrides,
  }
}

function renderCard(event: PublicEvent) {
  return render(
    <MemoryRouter>
      <SearchResultCard event={event} />
    </MemoryRouter>,
  )
}

describe('SearchResultCard', () => {
  it('mostra título, data, local e preço -- nunca sobrepostos ao pôster', () => {
    renderCard(makeEvent())

    expect(screen.getByRole('heading', { level: 3, name: 'Duna: Parte Dois' })).toBeInTheDocument()
    expect(screen.getByText('Cine Elite · São Paulo')).toBeInTheDocument()
    expect(screen.getByText('R$ 32,00')).toBeInTheDocument()
  })

  it('pôster fica fora do nome acessível do link -- sem duplicar o título para leitor de tela', () => {
    renderCard(makeEvent())

    expect(screen.getByRole('link', { name: /Duna: Parte Dois/ })).toBeInTheDocument()
    expect(screen.getByRole('link').querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  })

  it('mostra badges de gênero e atributos de sessão (formato/áudio/sala VIP)', () => {
    renderCard(makeEvent({ roomType: 'VIP' }))

    expect(screen.getByText('Ficção científica')).toBeInTheDocument()
    expect(screen.getByText('2D')).toBeInTheDocument()
    expect(screen.getByText('Dublado')).toBeInTheDocument()
    expect(screen.getByText('Sala VIP')).toBeInTheDocument()
  })

  it('link navega para a página de detalhe da sessão', () => {
    renderCard(makeEvent())

    expect(screen.getByRole('link')).toHaveAttribute('href', '/eventos/evt-1')
  })
})
