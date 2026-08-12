import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { RouteErrorBoundary } from './ErrorBoundary'
import { NotFoundPage } from './routes/NotFoundPage'
import { PlaceholderPage } from './routes/PlaceholderPage'

// Guards por papel entram na etapa 03 (autenticação) -- por ora toda rota é
// alcançável, só para provar que o roteamento em si funciona.
//
// `lazy` é o mecanismo do próprio React Router 7 (não `React.lazy` + `Suspense`
// manual): o router baixa o módulo só quando a navegação de fato pede aquela rota,
// sem exigir um `<Suspense>` por rota. Três grupos pesados (§ etapa 01, riscos):
// leitor de QR (~200 kB) em /portaria, Stripe.js em /checkout/*, painel completo do
// organizador em /organizador/*. Quem só navega no catálogo público nunca baixa
// nenhum dos três.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <PlaceholderPage title="Catálogo" etapa="etapa 05" /> },
      { path: 'eventos/:id', element: <PlaceholderPage title="Detalhe do evento" etapa="etapa 05" /> },
      { path: 'eventos/:id/assentos', element: <PlaceholderPage title="Mapa de assentos" etapa="etapa 06" /> },

      {
        path: 'checkout/:orderId',
        lazy: () => import('./routes/CheckoutPage').then((m) => ({ Component: m.default })),
      },
      {
        path: 'checkout/:orderId/retorno',
        lazy: () => import('./routes/CheckoutPage').then((m) => ({ Component: m.default })),
      },

      { path: 'ingressos', element: <PlaceholderPage title="Meus ingressos" etapa="etapa 09" /> },
      { path: 'ingressos/:id', element: <PlaceholderPage title="Ingresso" etapa="etapa 09" /> },
      { path: 's/:shareToken', element: <PlaceholderPage title="Ingresso compartilhado" etapa="etapa 09" /> },

      { path: 'entrar', element: <PlaceholderPage title="Entrar" etapa="etapa 03" /> },
      { path: 'cadastrar', element: <PlaceholderPage title="Cadastrar" etapa="etapa 03" /> },

      {
        path: 'organizador',
        lazy: () => import('./routes/OrganizadorPage').then((m) => ({ Component: m.default })),
      },
      {
        path: 'organizador/eventos/nova',
        lazy: () => import('./routes/OrganizadorPage').then((m) => ({ Component: m.default })),
      },
      {
        path: 'organizador/eventos/:id',
        lazy: () => import('./routes/OrganizadorPage').then((m) => ({ Component: m.default })),
      },

      {
        path: 'portaria',
        lazy: () => import('./routes/PortariaPage').then((m) => ({ Component: m.default })),
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
