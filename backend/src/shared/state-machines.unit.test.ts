import { describe, expect, it } from 'vitest'
import { EventStatus, OrderStatus, TicketStatus } from '../../generated/prisma/enums'
import { InvalidTransitionError } from './errors'
import { EVENT_TRANSITIONS, ORDER_TRANSITIONS, TICKET_TRANSITIONS, assertTransition } from './state-machines'

function testTransitionTable<S extends string>(transitions: Record<S, S[]>, allStates: S[]) {
  it('aceita toda transição declarada na tabela', () => {
    for (const from of allStates) {
      for (const to of transitions[from]) {
        expect(() => assertTransition(transitions, from, to)).not.toThrow()
      }
    }
  })

  it('rejeita toda transição fora da tabela', () => {
    for (const from of allStates) {
      const allowed = transitions[from]
      for (const to of allStates) {
        if (allowed.includes(to)) continue
        expect(() => assertTransition(transitions, from, to)).toThrow(InvalidTransitionError)
      }
    }
  })

  it('estados terminais (sem transições declaradas) rejeitam qualquer destino', () => {
    for (const from of allStates) {
      if (transitions[from].length > 0) continue
      for (const to of allStates) {
        expect(() => assertTransition(transitions, from, to)).toThrow(InvalidTransitionError)
      }
    }
  })
}

describe('Order transitions', () => {
  testTransitionTable(ORDER_TRANSITIONS, Object.values(OrderStatus))
})

describe('Ticket transitions', () => {
  testTransitionTable(TICKET_TRANSITIONS, Object.values(TicketStatus))
})

describe('Event transitions', () => {
  testTransitionTable(EVENT_TRANSITIONS, Object.values(EventStatus))
})
