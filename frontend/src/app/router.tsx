import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import CatalogPage from '../features/catalog/pages/CatalogPage'
import EventDetailPage from '../features/catalog/pages/EventDetailPage'
import { RequireAuth, RequireRole } from '../features/auth/guards'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { RegisterPage } from '../features/auth/pages/RegisterPage'
import { Layout } from './Layout'
import { RouteErrorBoundary } from './ErrorBoundary'
import { NotFoundPage } from './routes/NotFoundPage'
import { PlaceholderPage } from './routes/PlaceholderPage'

// /estilo é ferramenta de desenvolvimento (conferência visual dos tokens/componentes,
// substitui Storybook -- etapa 02), não tela de produto: `import.meta.env.DEV` é
// substituído em build time, então o Rollup elimina esta rota e o import de
// StyleGuidePage inteiro do bundle de produção (ninguém navega pra cá em prod).
const devOnlyRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: 'estilo',
        lazy: () => import('./routes/StyleGuidePage').then((m) => ({ Component: m.default })),
      },
    ]
  : []

// `lazy` é o mecanismo do próprio React Router 7 (não `React.lazy` + `Suspense`
// manual): o router baixa o módulo só quando a navegação de fato pede aquela rota,
// sem exigir um `<Suspense>` por rota. Três grupos pesados (§ etapa 01, riscos):
// leitor de QR (~200 kB) em /portaria, Stripe.js em /checkout/*, painel completo do
// organizador em /organizador/*. Quem só navega no catálogo público nunca baixa
// nenhum dos três.
//
// Guards por papel (etapa 03, §7.5): `RequireAuth` engloba ingressos/organizador/
// portaria; `RequireRole` aninhado dentro dele só checa o papel (a autenticação já
// foi resolvida pelo pai). `/`, `/eventos/*`, `/s/:token`, `/entrar`, `/cadastrar` e
// `/checkout/*` seguem públicas -- nem o plano nem o back-end (rotas com
// `optionalAuth`) pedem sessão para elas ainda.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      // catálogo público -- carregamento direto, não `lazy()` (etapa 05): é a
      // primeira tela de ~todo visitante, diferente dos três grupos pesados abaixo
      // que só uma fração de quem acessa o site chega a baixar
      { index: true, element: <CatalogPage /> },
      { path: 'eventos/:id', element: <EventDetailPage /> },
      { path: 'eventos/:id/assentos', element: <PlaceholderPage title="Mapa de assentos" etapa="etapa 06" /> },

      {
        path: 'checkout/:orderId',
        lazy: () => import('./routes/CheckoutPage').then((m) => ({ Component: m.default })),
      },
      {
        path: 'checkout/:orderId/retorno',
        lazy: () => import('./routes/CheckoutPage').then((m) => ({ Component: m.default })),
      },

      { path: 's/:shareToken', element: <PlaceholderPage title="Ingresso compartilhado" etapa="etapa 09" /> },

      { path: 'entrar', element: <LoginPage /> },
      { path: 'cadastrar', element: <RegisterPage /> },

      {
        element: <RequireAuth />,
        children: [
          { path: 'ingressos', element: <PlaceholderPage title="Meus ingressos" etapa="etapa 09" /> },
          { path: 'ingressos/:id', element: <PlaceholderPage title="Ingresso" etapa="etapa 09" /> },

          {
            // painel completo do organizador (busca no TMDb, wizard de criação,
            // gestão de sessão, upload de imagem) -- etapa 04
            element: <RequireRole role="ORGANIZER" />,
            children: [
              {
                path: 'organizador',
                lazy: () =>
                  import('../features/organizador/pages/OrganizadorListPage').then((m) => ({
                    Component: m.default,
                  })),
              },
              {
                path: 'organizador/eventos/nova',
                lazy: () =>
                  import('../features/organizador/pages/CreateEventWizard').then((m) => ({
                    Component: m.default,
                  })),
              },
              {
                path: 'organizador/eventos/:id',
                lazy: () =>
                  import('../features/organizador/pages/EventDetailPage').then((m) => ({
                    Component: m.default,
                  })),
              },
            ],
          },

          {
            element: <RequireRole role="GATE" />,
            children: [
              {
                path: 'portaria',
                lazy: () => import('./routes/PortariaPage').then((m) => ({ Component: m.default })),
              },
            ],
          },
        ],
      },

      ...devOnlyRoutes,

      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
