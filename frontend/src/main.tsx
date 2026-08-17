import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { AppProviders } from './app/providers'
import { router } from './app/router'
import { env } from './lib/env'
import './styles/reset.css'
import './styles/tokens.css'
import './styles/typography.css'

async function enableMocking(): Promise<unknown> {
  if (!env.VITE_USE_MSW) return
  const { worker } = await import('./test/msw/browser')
  return worker.start({ onUnhandledRequest: 'bypass' })
}

void enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  )
})
