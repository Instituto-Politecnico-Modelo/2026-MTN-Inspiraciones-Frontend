import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUpRight, ChartNoAxesCombined, Compass, Flag, House, Images, Inbox, Info, LogOut, Menu, Plus, ShieldCheck, Trophy, UserRound, Users } from 'lucide-react'
import { Link, NavLink, Navigate, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom'
import { useDemo } from '../context/DemoContext'
import { canManage, profilePath } from '../data/store'
import { Avatar, EmptyState, Modal } from './UI'
import { Brand } from './Brand'

export const userNavigation = [
  { path: '/inicio', label: 'Inicio', icon: House },
  { path: '/descubrir', label: 'Descubrir', icon: Compass },
  { path: '/desafios', label: 'Desafíos', icon: Trophy },
  { path: '/perfil', label: 'Perfil', icon: UserRound },
]
export const adminNavigation = [
  { path: '/admin/resumen', label: 'Resumen', icon: House },
  { path: '/admin/usuarios', label: 'Usuarios', icon: Users },
  { path: '/admin/publicaciones', label: 'Publicaciones', icon: Images },
  { path: '/admin/moderacion', label: 'Moderación', icon: Flag },
  { path: '/admin/desafios', label: 'Desafíos', icon: Trophy },
  { path: '/admin/solicitudes', label: 'Solicitudes', icon: Inbox },
  { path: '/admin/reportes', label: 'Reportes', icon: ChartNoAxesCombined },
  { path: '/admin/accesos', label: 'Accesos', icon: ShieldCheck },
]

export function useAccountGate() {
  const { user } = useDemo()
  const location = useLocation()
  const navigate = useNavigate()
  return () => {
    if (!user) {
      navigate(`/ingresar?volver=${encodeURIComponent(location.pathname + location.search)}`)
      return false
    }
    if (user.status === 'suspended') { navigate('/apelacion'); return false }
    return true
  }
}

export function RequireAccount({ children }: { children: ReactNode }) {
  const { user } = useDemo()
  const location = useLocation()
  if (!user) return <Navigate to={`/ingresar?volver=${encodeURIComponent(location.pathname + location.search)}`} replace />
  if (user.status !== 'active') return <Navigate to="/apelacion" replace />
  return children
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useDemo()
  const location = useLocation()
  if (!user) return <Navigate to={`/ingresar?modo=admin&volver=${encodeURIComponent(location.pathname + location.search)}`} replace />
  if (!canManage(user)) return <main className="startup"><Brand /><h1>Solo administración</h1><EmptyState icon={ShieldCheck} title="Este perfil no tiene acceso al panel"
    description="Podés volver a la comunidad o elegir explícitamente el perfil de administración."
    action={<div className="button-row"><Link className="button button-secondary" to="/inicio">Volver a Inicio</Link><Link className="button button-primary" to="/ingresar?modo=admin">Ingresar como administrador</Link></div>} /></main>
  return children
}

export function SiteLayout({ admin = false }: { admin?: boolean }) {
  const { user } = useDemo()
  const location = useLocation()
  const main = useRef<HTMLElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const navigation = admin ? adminNavigation : userNavigation.map(item => item.path === '/perfil' && user ? { ...item, path: profilePath(user) } : item)
  useEffect(() => {
    main.current?.focus({ preventScroll: true })
    document.title = `${admin ? 'Administración · ' : ''}Trama`
  }, [location.pathname, admin])

  const links = (mobile = false) => (mobile && admin ? [adminNavigation[0], adminNavigation[2], adminNavigation[3]] : navigation).map(item =>
    <NavLink key={item.path} to={item.path} aria-label={item.label} title={item.label} className={({ isActive }) => isActive ? 'nav-item is-active' : 'nav-item'}>
      <item.icon size={22} strokeWidth={1.8} aria-hidden="true" /><span>{item.label}</span>
    </NavLink>)
  const publishLink = <Link key="publicar" className="nav-publish" to="/publicar" aria-label="Publicar una obra" title="Publicar una obra"><Plus size={22} strokeWidth={2} aria-hidden="true" /><span>Publicar</span></Link>
  const mobileLinks = links(true)
  if (!admin) mobileLinks.splice(2, 0, publishLink)
  return <div className={`app-frame ${admin ? 'admin-frame' : ''}`}>
    <a href="#contenido" className="skip-link">Saltar al contenido</a>
    <aside className="sidebar">
      <Link className="brand-link" to={admin ? '/admin/resumen' : '/inicio'} aria-label="Trama, ir al inicio"><Brand /></Link>
      {admin && <span className="admin-marker">Administración</span>}
      <nav className="primary-nav" aria-label={admin ? 'Administración' : 'Principal'}>{links()}{!admin && <Link className="nav-publish nav-publish-side" to="/publicar" aria-label="Publicar una obra" title="Publicar una obra"><Plus size={22} strokeWidth={2} aria-hidden="true" /><span>Publicar</span></Link>}</nav>
      <div className="sidebar-bottom">
        {admin ? <Link className="nav-item" to="/inicio" aria-label="Ver comunidad" title="Ver comunidad"><ArrowUpRight size={21} aria-hidden="true" /><span>Ver comunidad</span></Link>
          : canManage(user) && <Link className="nav-item" to="/admin/resumen" aria-label="Administración" title="Administración"><ShieldCheck size={21} aria-hidden="true" /><span>Administración</span></Link>}
        <Link className="nav-item" to="/acerca" aria-label="Acerca de Trama" title="Acerca de Trama"><Info size={21} aria-hidden="true" /><span>Acerca de Trama</span></Link>
        {user ? <>
          <Link className="sidebar-profile" to={profilePath(user)}><Avatar user={user} size="medium" /><span><strong>{user.name}</strong><small>@{user.handle}</small></span></Link>
          <Link className="nav-item logout-link" to="/salir" aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={20} aria-hidden="true" /><span>Cerrar sesión</span></Link>
        </> : <Link className="button button-secondary sidebar-login" to="/ingresar">Ingresar</Link>}
      </div>
    </aside>
    <div className="workspace">
      <header className="site-header">
        <Link className="mobile-brand" to={admin ? '/admin/resumen' : '/inicio'} aria-label="Trama, ir al inicio"><Brand /></Link>
        <div className="header-actions">
          {admin && <Link className="button button-secondary" to="/inicio" aria-label="Comunidad" title="Ver comunidad"><ArrowUpRight size={19} aria-hidden="true" /><span className="desktop-label">Comunidad</span></Link>}
        </div>
      </header>
      {user?.status === 'suspended' && <div className="account-warning" role="status">Tu cuenta está suspendida. <Link to="/apelacion">Solicitar revisión</Link></div>}
      <main id="contenido" className="app-content" ref={main} tabIndex={-1}><Outlet /></main>
      <footer className="site-footer"><span>Trama · Comunidad para artistas</span><Link to="/acerca">Acerca de Trama</Link></footer>
    </div>
    <nav className="bottom-nav" aria-label={admin ? 'Administración móvil' : 'Principal móvil'}>
      {mobileLinks}
      {admin && <button className={`nav-item ${menuOpen ? 'is-active' : ''}`} type="button" aria-expanded={menuOpen} aria-haspopup="dialog" onClick={() => setMenuOpen(true)}><Menu size={23} aria-hidden="true" /><span>Más</span></button>}
    </nav>
    {menuOpen && <Modal open title="Administración" onClose={() => setMenuOpen(false)} className="navigation-modal">
      <nav aria-label="Todas las secciones administrativas">{adminNavigation.map(item => <Link className="nav-item" key={item.path} to={item.path} onClick={() => setMenuOpen(false)}><item.icon size={22} aria-hidden="true" />{item.label}</Link>)}</nav>
      <Link className="nav-item" to="/salir" onClick={() => setMenuOpen(false)}><LogOut size={21} aria-hidden="true" />Cerrar sesión</Link>
    </Modal>}
    <ScrollRestoration getKey={entry => entry.pathname + entry.search} />
  </div>
}
