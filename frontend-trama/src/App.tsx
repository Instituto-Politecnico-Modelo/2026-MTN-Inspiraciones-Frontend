import { useEffect } from 'react'
import { Navigate, Outlet, useRouteError, type RouteObject } from 'react-router-dom'
import { Brand } from './components/Brand'
import { RequireAccount, RequireAdmin, SiteLayout } from './components/Shell'
import { Button } from './components/UI'
import { DemoProvider, type Backend } from './context/DemoContext'
import { AccessPage, LogoutPage, RecoveryPage } from './pages/Access'
import { AppealPage, ChallengeDetailPage, ChallengesPage, MyProposalsPage, ProposeChallengePage } from './pages/Challenges'
import { DiscoverPage } from './pages/Discover'
import { EditProfilePage, PublishPage } from './pages/Editors'
import { HomePage } from './pages/Home'
import { OnboardingPage } from './pages/Onboarding'
import { BlockedPage, FolderPage, ProfilePage } from './pages/Profile'
import { MissingPage, WorkPage } from './pages/Work'

const adminPage = (name: keyof typeof import('./pages/Admin')) => async () => ({ Component: (await import('./pages/Admin'))[name] })

function RouteLoading() {
  return <main className="startup"><Brand /><h1>Abriendo Trama</h1><p role="status">Cargando esta sección…</p></main>
}

function RouteFailure() {
  const error = useRouteError()
  useEffect(() => { console.error('[Trama] Error de navegacion.', error) }, [error])
  return <main className="startup"><Brand /><h1>No pudimos abrir esta página</h1>
    <p>Podés reintentar o volver a Inicio. Tus datos no se modificaron.</p>
    <div className="button-row"><Button onClick={() => window.location.reload()}>Reintentar</Button><a className="button button-secondary" href="/inicio">Ir a Inicio</a></div>
  </main>
}

export function createAppRoutes(repository?: Backend): RouteObject[] {
  return [{
    element: <DemoProvider repository={repository}><Outlet /></DemoProvider>,
    errorElement: <RouteFailure />,
    HydrateFallback: RouteLoading,
    children: [
      { path: 'ingresar', element: <AccessPage key="ingresar" /> },
      { path: 'registro', element: <AccessPage key="registro" register /> },
      { path: 'recuperar', element: <RecoveryPage /> },
      { path: 'salir', element: <LogoutPage /> },
      {
        path: 'admin',
        element: <RequireAdmin><SiteLayout admin /></RequireAdmin>,
        children: [
          { index: true, element: <Navigate to="resumen" replace /> },
          { path: 'resumen', lazy: adminPage('AdminSummaryPage') },
          { path: 'usuarios', lazy: adminPage('AdminUsersPage') },
          { path: 'publicaciones', lazy: adminPage('AdminPostsPage') },
          { path: 'desafios', lazy: async () => ({ Component: (await import('./pages/AdminChallenges')).AdminChallengesPage }) },
          { path: 'desafios/nuevo', lazy: async () => ({ Component: (await import('./pages/AdminChallenges')).AdminChallengeEditorPage }) },
          { path: 'desafios/:id/editar', lazy: async () => ({ Component: (await import('./pages/AdminChallenges')).AdminChallengeEditorPage }) },
          { path: 'moderacion', lazy: adminPage('AdminModerationPage') },
          { path: 'moderacion/reportes/:id', lazy: adminPage('AdminReportPage') },
          { path: 'moderacion/apelaciones/:id', lazy: adminPage('AdminAppealPage') },
          { path: 'solicitudes', lazy: adminPage('AdminRequestsPage') },
          { path: 'solicitudes/:id', lazy: adminPage('AdminRequestPage') },
          { path: 'reportes', lazy: adminPage('AdminReportsPage') },
          { path: 'accesos', lazy: adminPage('AdminAccessPage') },
          { path: '*', element: <MissingPage /> },
        ],
      },
      {
        element: <SiteLayout />,
        children: [
          { index: true, element: <Navigate to="/inicio" replace /> },
          { path: 'inicio', element: <HomePage /> },
          { path: 'descubrir', element: <DiscoverPage /> },
          { path: 'desafios', element: <ChallengesPage /> },
          { path: 'desafios/proponer', element: <RequireAccount><ProposeChallengePage /></RequireAccount> },
          { path: 'desafios/mis-propuestas', element: <RequireAccount><MyProposalsPage /></RequireAccount> },
          { path: 'desafios/:id', element: <ChallengeDetailPage /> },
          { path: 'perfil', element: <RequireAccount><ProfilePage /></RequireAccount> },
          { path: 'perfil/editar', element: <RequireAccount><EditProfilePage /></RequireAccount> },
          { path: 'perfil/bloqueados', element: <RequireAccount><BlockedPage /></RequireAccount> },
          { path: 'perfil/:id', element: <ProfilePage /> },
          { path: 'carpeta/:id', element: <RequireAccount><FolderPage /></RequireAccount> },
          { path: 'cuestionario', element: <RequireAccount><OnboardingPage /></RequireAccount> },
          { path: 'publicar', element: <RequireAccount><PublishPage /></RequireAccount> },
          { path: 'obra/:id', element: <WorkPage /> },
          { path: 'obra/:id/editar', element: <RequireAccount><PublishPage /></RequireAccount> },
          { path: 'apelacion', element: <AppealPage /> },
          { path: 'acerca', lazy: async () => ({ Component: (await import('./pages/About')).AboutPage }) },
          { path: '*', element: <MissingPage /> },
        ],
      },
    ],
  }]
}