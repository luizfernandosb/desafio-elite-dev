import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import CatalogPage from '../features/catalog/pages/CatalogPage'
import EventDetailPage from '../features/catalog/pages/EventDetailPage'
import { RequireAuth, RequireRole } from '../features/auth/guards'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { RegisterPage } from '../features/auth/pages/RegisterPage'
import { Layout } from './Layout'
import { RouteErrorBoundary } from './ErrorBoundary'
import { NotFoundPage } from './routes/NotFoundPage'

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
// Guards por papel (etapa 03, §7.5): `RequireAuth` engloba ingressos/checkout/
// assentos/organizador (dentro de `<Layout>`) e portaria (fora, § etapa 10, própria
// árvore no fim deste array); `RequireRole` aninhado dentro dele só checa o papel (a
// autenticação já foi resolvida pelo pai). Só `/`, `/eventos/:id`, `/share/:token`,
// `/entrar` e `/cadastrar` seguem públicas -- ver evento é público de propósito
// (etapa 05), mas escolher assentos e pagar exigem conta (back:
// `requireRole(Role.CUSTOMER)` em holds e orders).
// Extraído de `createBrowserRouter` (não só um argumento inline) para os testes
// ponta a ponta (§ etapa 13) montarem a MESMA árvore de rotas com
// `createMemoryRouter`, em vez de duplicar a lista à mão e arriscar divergir da
// árvore real de produção.
export const routes: RouteObject[] = [
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

      { path: 'entrar', element: <LoginPage /> },
      { path: 'cadastrar', element: <RegisterPage /> },

      {
        element: <RequireAuth />,
        children: [
          {
            path: 'ingressos',
            lazy: () =>
              import('../features/tickets/pages/TicketListPage').then((m) => ({ Component: m.default })),
          },
          {
            path: 'ingressos/:id',
            lazy: () =>
              import('../features/tickets/pages/TicketDetailPage').then((m) => ({ Component: m.default })),
          },

          {
            // escolher assentos exige conta (§ etapa 05, decidido no CTA de
            // EventDetailPage: só o clique de "Escolher assentos" força login, ver
            // evento continua público) -- só clientes de fato criam hold no back
            // (`requireRole(Role.CUSTOMER)`, seat-hold.routes.ts), papel errado vira
            // FORBIDDEN tratado como qualquer outro erro de hold (etapa 06)
            path: 'eventos/:id/assentos',
            lazy: () =>
              import('../features/reserva/pages/SeatSelectionPage').then((m) => ({ Component: m.default })),
          },

          // checkout também exige conta (mesmo raciocínio do mapa de assentos --
          // POST /orders e /simulate-payment exigem CUSTOMER, etapa 08)
          {
            path: 'checkout/:orderId',
            lazy: () =>
              import('../features/checkout/pages/CheckoutPage').then((m) => ({ Component: m.default })),
          },
          {
            path: 'checkout/:orderId/retorno',
            lazy: () =>
              import('../features/checkout/pages/CheckoutReturnPage').then((m) => ({ Component: m.default })),
          },

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
        ],
      },

      ...devOnlyRoutes,

      { path: '*', element: <NotFoundPage /> },
    ],
  },

  // fora de <Layout> de propósito (§ etapa 09) -- é a página que um estranho abre a
  // partir de um link de compartilhamento, sem header, sem nav, sem sessão. URL
  // (`/share/:token`) espelha exatamente o que o back monta em `APP_PUBLIC_URL`
  // (`ticket.service.ts`, `buildShareUrl`) -- mudar aqui sem mudar lá quebra todo link
  // já compartilhado.
  {
    path: '/share/:shareToken',
    errorElement: <RouteErrorBoundary />,
    lazy: () => import('../features/tickets/pages/SharedTicketPage').then((m) => ({ Component: m.default })),
  },

  // também fora de <Layout> (§ etapa 10) -- "tela cheia, sem o header/nav do resto da
  // aplicação" é uma decisão explícita do plano, não um esquecimento: portaria não
  // navega para outro lugar durante o turno, cada pixel de header é distração num
  // fluxo de alta frequência. Ainda atrás de `RequireAuth`/`RequireRole('GATE')` --
  // só a casca visual (Layout) fica de fora, a autorização continua igual.
  {
    path: '/portaria',
    errorElement: <RouteErrorBoundary />,
    element: <RequireAuth />,
    children: [
      {
        element: <RequireRole role="GATE" />,
        children: [
          {
            index: true,
            lazy: () => import('../features/gate/pages/PortariaPage').then((m) => ({ Component: m.default })),
          },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
