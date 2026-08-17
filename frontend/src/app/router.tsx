import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import CatalogPage from '../features/catalog/pages/CatalogPage'
import EventDetailPage from '../features/catalog/pages/EventDetailPage'
import { RequireAuth, RequireRole } from '../features/auth/guards'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { RegisterPage } from '../features/auth/pages/RegisterPage'
import { Layout } from './Layout'
import { RouteErrorBoundary } from './ErrorBoundary'
import { NotFoundPage } from './routes/NotFoundPage'

const devOnlyRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: 'estilo',
        lazy: () => import('./routes/StyleGuidePage').then((m) => ({ Component: m.default })),
      },
    ]
  : []

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteErrorBoundary />,
    children: [
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
            path: 'eventos/:id/assentos',
            lazy: () =>
              import('../features/reserva/pages/SeatSelectionPage').then((m) => ({ Component: m.default })),
          },

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

  {
    path: '/share/:shareToken',
    errorElement: <RouteErrorBoundary />,
    lazy: () => import('../features/tickets/pages/SharedTicketPage').then((m) => ({ Component: m.default })),
  },

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
