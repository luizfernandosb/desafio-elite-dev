import { setupServer } from 'msw/node'
import { handlers } from './handlers'
import { storageHandlers } from './storage-handlers'

export const server = setupServer(...handlers, ...storageHandlers)
