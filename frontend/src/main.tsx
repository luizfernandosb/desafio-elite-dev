import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { AppProviders } from './app/providers'
import { router } from './app/router'
import { env } from './lib/env'
import './styles/reset.css'

// VITE_USE_MSW liga o mock de rede em desenvolvimento, sem precisar do back-end
// rodando (§ etapa 01, "MSW desde o dia 0"). Import dinâmico: o código do MSW só
// entra no bundle carregado em runtime se este branch de fato executar -- em
// produção (`VITE_USE_MSW=false`, o default) ele nunca roda.
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
