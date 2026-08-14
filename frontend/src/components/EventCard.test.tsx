import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EventCard } from './EventCard'

describe('EventCard', () => {
  it('mostra o selo de classificação quando presente', () => {
    render(<EventCard imageUrl="https://example.com/poster.jpg" title="Duna: Parte Dois" ageRating="14" />)

    expect(screen.getByText('14')).toBeInTheDocument()
  })

  it('sem ageRating -- não mostra nenhum selo', () => {
    render(<EventCard imageUrl="https://example.com/poster.jpg" title="Duna: Parte Dois" />)

    expect(screen.queryByText(/^(L|10|12|14|16|18)$/)).not.toBeInTheDocument()
  })

  it('título continua no DOM (oculto visualmente) -- card não fica sem nome acessível', () => {
    const { container } = render(<EventCard title="Duna: Parte Dois" />)

    expect(screen.getByText('Duna: Parte Dois')).toBeInTheDocument()
    expect(container.querySelector('img')).not.toBeInTheDocument()
  })

  it('sem imageUrl -- não renderiza <img> quebrado', () => {
    const { container } = render(<EventCard title="Sem pôster" />)

    expect(container.querySelector('img')).not.toBeInTheDocument()
  })
})
