import { useState, type ReactNode } from 'react'
import { ArrowRight, Ban, Check, Download, Eye, EyeOff, Flag, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { CommandDialog, type Confirmation } from '../components/CommandDialog'
import { Avatar, Badge, Button, EmptyState, ErrorMessage, IconButton, PageTitle, SearchField, SelectField, Tabs, statusLabels } from '../components/UI'
import { useDemo } from '../context/DemoContext'
import type { Report, User } from '../data/model'
import { challengeStatus, errorMessage, normalize, toCsv, visiblePosts } from '../data/store'
import { backPath, formatDate, formatDateTime } from '../lib/format'

const userStatuses = [{ value: 'todos', label: 'Todos los estados' }, { value: 'active', label: 'Activas' }, { value: 'suspended', label: 'Suspendidas' }, { value: 'deleted', label: 'Eliminadas' }]
const reviewStatuses = [{ value: 'todos', label: 'Todos los estados' }, { value: 'pending', label: 'Pendientes' }, { value: 'approved', label: 'Aprobadas' }, { value: 'rejected', label: 'Rechazadas' }]

function useFilters(defaultStatus = 'todos') {
  const [params, setParams] = useSearchParams()
  const update = (values: Record<string, string>) => {
    const next = new URLSearchParams(params)
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    setParams(next, { replace: true, preventScrollReset: true })
  }
  return { params, query: params.get('q') ?? '', status: params.get('estado') ?? defaultStatus, update }
}

function AdminTable({ label, columns, children }: { label: string; columns: string[]; children: ReactNode }) {
  return <div className="table-scroll" role="region" aria-label={label} tabIndex={0}><table className="admin-table"><caption className="sr-only">{label}</caption>
    <thead><tr>{columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{children}</tbody>
  </table></div>
}

function Resolution({ record }: { record: Pick<Report, 'note' | 'resolvedAt' | 'resolvedBy'> }) {
  const { state } = useDemo()
  return <section className="review-resolution"><h2>Resolución</h2><p>{record.note}</p>
    <p className="meta">{record.resolvedAt && formatDateTime(record.resolvedAt)} · {state.users.find(member => member.id === record.resolvedBy)?.name ?? 'Equipo de la demo'}</p>
  </section>
}

export function AdminSummaryPage() {
  const { state } = useDemo()
  const metrics = [
    { label: 'Perfiles activos', value: state.users.filter(member => member.status === 'active').length, to: '/admin/usuarios?estado=active' },
    { label: 'Obras públicas', value: visiblePosts(state).length, to: '/admin/publicaciones' },
    { label: 'Reportes pendientes', value: state.reports.filter(report => report.status === 'pending').length, to: '/admin/moderacion' },
    { label: 'Propuestas pendientes', value: state.requests.filter(request => request.status === 'pending').length, to: '/admin/solicitudes' },
  ]
  const activity = state.audit.slice(-8).reverse()
  const openCount = state.challenges.filter(challenge => challengeStatus(challenge) === 'open').length
  const pendingAppeals = state.appeals.filter(appeal => appeal.status === 'pending').length
  return <><PageTitle title="Resumen" description="El estado actual de esta comunidad de demostración." />
    <dl className="admin-metrics">{metrics.map(metric => <div key={metric.label}><dt><Link to={metric.to}>{metric.label}<ArrowRight size={16} aria-hidden="true" /></Link></dt><dd>{metric.value}</dd></div>)}</dl>
    <div className="admin-summary-links"><Link to="/admin/desafios"><strong>{openCount}</strong> {openCount === 1 ? 'desafío abierto' : 'desafíos abiertos'}<ArrowRight size={18} aria-hidden="true" /></Link>
      <Link to="/admin/moderacion?vista=apelaciones"><strong>{pendingAppeals}</strong> {pendingAppeals === 1 ? 'apelación pendiente' : 'apelaciones pendientes'}<ArrowRight size={18} aria-hidden="true" /></Link></div>
    <section className="admin-section"><div className="section-heading"><h2>Actividad reciente</h2><Link to="/admin/reportes">Ver actividad<ArrowRight size={17} aria-hidden="true" /></Link></div>
      {activity.length ? <ul className="activity-list">{activity.map(entry => <li key={entry.id}><span>{entry.label}</span><small>{state.users.find(member => member.id === entry.actorId)?.name} · {formatDateTime(entry.createdAt)}</small></li>)}</ul>
        : <EmptyState icon={ShieldCheck} title="Todavía no hay decisiones registradas" description="Las acciones de administración quedarán en la actividad local de esta demo." />}
    </section></>
}

export function AdminUsersPage() {
  const { state, user } = useDemo()
  const { query, status, update } = useFilters()
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const users = state.users.filter(member => (status === 'todos' || member.status === status) && normalize(`${member.name} ${member.handle} ${member.email}`).includes(normalize(query)))
  const changeStatus = (member: User, next: User['status']) => setConfirmation({
    title: next === 'suspended' ? 'Suspender este perfil' : next === 'active' ? 'Reactivar este perfil' : 'Eliminar este perfil',
    description: next === 'deleted' ? `Se retirarán las obras, comentarios, likes y carpetas de ${member.name}. No se puede deshacer sin reiniciar la demo.` : next === 'suspended' ? `Las obras de ${member.name} dejarán de ser públicas mientras la cuenta esté suspendida. Podrá solicitar una revisión.` : `${member.name} podrá volver a participar. Sus obras no eliminadas ni ocultas volverán a mostrarse.`,
    label: next === 'suspended' ? 'Suspender perfil' : next === 'active' ? 'Reactivar perfil' : 'Eliminar perfil',
    reason: true, maxReasonLength: 1000, dangerous: next !== 'active',
    command: reason => ({ type: 'set-user-status', userId: member.id, status: next, reason }),
    success: 'El estado del perfil se actualizó en la demo.',
  })
  return <><PageTitle title="Usuarios" description="Perfiles locales, estado de las cuentas y decisiones de la comunidad." />
    <div className="filter-row"><SearchField label="Buscar perfiles" placeholder="Nombre, usuario o correo" value={query} onChange={value => update({ q: value })} /><SelectField label="Estado" value={status} options={userStatuses} onChange={event => update({ estado: event.target.value })} /></div>
    <p className="filter-summary" role="status">{users.length} perfiles</p>
    {users.length ? <AdminTable label="Perfiles de la demo" columns={['Perfil', 'Rol', 'Estado', 'Alta', 'Acciones']}>{users.map(member => <tr key={member.id}>
      <th scope="row"><div className="table-person"><Avatar user={member} size="medium" /><div>{member.status === 'active' ? <Link to={`/perfil/${member.id}`}>{member.name}</Link> : <strong>{member.name}</strong>}<small>@{member.handle}</small><small>{member.email}</small>{member.id === user?.id && <small>Tu sesión actual</small>}</div></div></th>
      <td><Badge status={member.role} /></td><td><Badge status={member.status} /></td><td className="date-cell">{formatDate(member.joinedAt)}</td>
      <td><div className="table-actions">{member.status !== 'deleted' && <>
        {member.status === 'active' ? <IconButton icon={Ban} label={`Suspender a ${member.name}`} disabled={member.id === user?.id} onClick={() => changeStatus(member, 'suspended')} /> : <IconButton icon={RotateCcw} label={`Reactivar a ${member.name}`} onClick={() => changeStatus(member, 'active')} />}
        <IconButton icon={Trash2} label={`Eliminar a ${member.name}`} disabled={member.id === user?.id} onClick={() => changeStatus(member, 'deleted')} />
      </>}</div></td>
    </tr>)}</AdminTable> : <EmptyState title="No hay perfiles con esos filtros" description="Probá otro nombre o cambiá el estado seleccionado." />}
    {confirmation && <CommandDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />}
  </>
}

export function AdminPostsPage() {
  const { state } = useDemo()
  const location = useLocation()
  const { query, status, params, update } = useFilters()
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const kind = params.get('medio') ?? 'todos'
  const publicIds = new Set(visiblePosts(state).map(post => post.id))
  const posts = state.posts.filter(post => (status === 'todos' || post.status === status) && (kind === 'todos' || post.kind === kind) && normalize(`${post.title} ${post.discipline} ${state.users.find(member => member.id === post.authorId)?.name}`).includes(normalize(query)))
  return <><PageTitle title="Publicaciones" description="Obras de la demo, incluida su disponibilidad pública." />
    <div className="filter-row"><SearchField label="Buscar publicaciones" placeholder="Título, disciplina o autor" value={query} onChange={value => update({ q: value })} />
      <SelectField label="Estado" value={status} onChange={event => update({ estado: event.target.value })} options={[{ value: 'todos', label: 'Todos' }, { value: 'published', label: 'Publicadas' }, { value: 'hidden', label: 'Ocultas' }, { value: 'deleted', label: 'Eliminadas' }]} />
      <SelectField label="Medio" value={kind} onChange={event => update({ medio: event.target.value })} options={[{ value: 'todos', label: 'Todos' }, { value: 'image', label: 'Imágenes' }, { value: 'audio', label: 'Audio' }]} /></div>
    <p className="filter-summary" role="status">{posts.length} publicaciones</p>
    {posts.length ? <AdminTable label="Publicaciones de la demo" columns={['Obra', 'Autoría', 'Estado', 'Fecha', 'Acciones']}>{posts.map(post => {
      const author = state.users.find(member => member.id === post.authorId)
      const change = (next: typeof post.status) => setConfirmation({ title: next === 'hidden' ? 'Ocultar esta publicación' : next === 'published' ? 'Restaurar esta publicación' : 'Eliminar esta publicación',
        description: next === 'deleted' ? `«${post.title}» dejará de estar disponible. No se puede deshacer sin reiniciar los datos.` : `Se cambiará la visibilidad de «${post.title}». La obra solo será pública si su autor tiene una cuenta activa.`,
        label: next === 'hidden' ? 'Ocultar obra' : next === 'published' ? 'Restaurar obra' : 'Eliminar obra', reason: true, dangerous: next !== 'published', command: reason => ({ type: 'moderate-post', postId: post.id, status: next, reason }), success: 'Estado de la publicación actualizado.' })
      return <tr key={post.id}><th scope="row"><Link className="table-work" to={`/obra/${post.id}`} state={{ from: location.pathname + location.search }}><img src={post.kind === 'audio' ? post.cover || '/media/sonido.svg' : post.src} alt="" /><span>{post.title}<small>{post.kind === 'audio' ? 'Audio' : 'Imagen'} · {post.discipline}</small></span></Link></th>
        <td>{author?.name ?? 'Perfil no disponible'}</td><td>{post.status === 'published' && !publicIds.has(post.id) ? <Badge>Cuenta no activa</Badge> : <Badge status={post.status} />}</td><td className="date-cell">{formatDate(post.createdAt)}</td>
        <td><div className="table-actions"><Link className="icon-button" to={`/obra/${post.id}`} state={{ from: location.pathname + location.search }} aria-label={`Ver ${post.title}`} title="Ver obra"><Eye size={21} aria-hidden="true" /></Link>
          {post.status !== 'deleted' && <><IconButton icon={post.status === 'hidden' ? RotateCcw : EyeOff} label={`${post.status === 'hidden' ? 'Restaurar' : 'Ocultar'} ${post.title}`} onClick={() => change(post.status === 'hidden' ? 'published' : 'hidden')} /><IconButton icon={Trash2} label={`Eliminar ${post.title}`} onClick={() => change('deleted')} /></>}</div></td></tr>
    })}</AdminTable> : <EmptyState title="No hay publicaciones con esos filtros" description="Cambiá el estado, el medio o las palabras de búsqueda." />}
    {confirmation && <CommandDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />}
  </>
}

export function AdminModerationPage() {
  const { state } = useDemo()
  const location = useLocation()
  const { query, status, params, update } = useFilters('pending')
  const appeals = params.get('vista') === 'apelaciones'
  const records = appeals ? state.appeals.map(record => ({ record, title: state.users.find(member => member.id === record.authorId)?.name ?? 'Perfil no disponible', detail: record.description, to: `/admin/moderacion/apelaciones/${record.id}` }))
    : state.reports.map(record => ({ record, title: state.posts.find(post => post.id === record.postId)?.title ?? 'Obra no disponible', detail: record.reason, to: `/admin/moderacion/reportes/${record.id}` }))
  const filtered = records.filter(({ record, title, detail }) => (status === 'todos' || record.status === status) && normalize(`${title} ${detail} ${record.description}`).includes(normalize(query)))
  return <><PageTitle title="Moderación" description="Reportes de obras y solicitudes de revisión de cuentas." />
    <Tabs label="Revisiones de la comunidad" value={appeals ? 'apelaciones' : 'reportes'} onChange={value => update({ vista: value, estado: 'pending', q: '' })} items={[{ value: 'reportes', label: 'Reportes' }, { value: 'apelaciones', label: 'Apelaciones' }]}>
      <div className="filter-row"><SearchField label="Buscar revisiones" value={query} onChange={value => update({ q: value })} /><SelectField label="Estado" value={status} onChange={event => update({ estado: event.target.value })} options={appeals ? reviewStatuses : [{ value: 'todos', label: 'Todos' }, { value: 'pending', label: 'Pendientes' }, { value: 'accepted', label: 'Aceptados' }, { value: 'dismissed', label: 'Desestimados' }]} /></div>
      <p className="filter-summary" role="status">{filtered.length} {appeals ? 'apelaciones' : 'reportes'}</p>
      {filtered.length ? <AdminTable label={appeals ? 'Apelaciones de cuentas' : 'Reportes de publicaciones'} columns={['Revisión', 'Estado', 'Fecha', 'Acción']}>{filtered.map(({ record, title, detail, to }) => <tr key={record.id}>
        <th scope="row"><Link className="table-title" to={to} state={{ from: location.pathname + location.search }}>{title}</Link><p className="table-description">{detail}</p></th><td><Badge status={record.status} /></td><td className="date-cell">{formatDate(record.createdAt)}</td>
        <td><Link className="icon-button" to={to} state={{ from: location.pathname + location.search }} aria-label={`Revisar ${title}`} title="Abrir revisión"><ArrowRight size={21} aria-hidden="true" /></Link></td>
      </tr>)}</AdminTable> : <EmptyState icon={Flag} title="No hay revisiones en esta selección" description="Podés consultar otros estados o cambiar la búsqueda." />}
    </Tabs>
  </>
}

function ReviewPage({ appeal = false }: { appeal?: boolean }) {
  const { state } = useDemo()
  const { id } = useParams()
  const location = useLocation()
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const record = appeal ? state.appeals.find(item => item.id === id) : state.reports.find(item => item.id === id)
  if (!record) return <EmptyState title="Esta revisión no está disponible" description="El enlace puede ser incorrecto o los datos de la demo pueden haber cambiado." action={<Link className="button button-secondary" to="/admin/moderacion">Volver a Moderación</Link>} />
  const member = state.users.find(candidate => candidate.id === record.authorId)
  const post = 'postId' in record ? state.posts.find(candidate => candidate.id === record.postId) : undefined
  const resolve = (approve: boolean) => setConfirmation({
    title: appeal ? approve ? 'Aceptar esta apelación' : 'Rechazar esta apelación' : approve ? 'Aceptar este reporte' : 'Desestimar este reporte',
    description: appeal ? approve ? 'La cuenta local será reactivada. La resolución quedará registrada y no se podrá volver a resolver esta apelación.' : 'La cuenta conservará su estado. La persona podrá consultar el motivo de esta resolución.' : approve ? 'La obra será ocultada, salvo que ya haya sido eliminada. Esta revisión quedará resuelta.' : 'No se cambiará el estado de la publicación. El reporte quedará resuelto.',
    label: appeal ? approve ? 'Aceptar apelación' : 'Rechazar apelación' : approve ? 'Aceptar reporte' : 'Desestimar reporte', reason: true, dangerous: !appeal && approve,
    command: note => appeal ? { type: 'review-appeal', appealId: record.id, status: approve ? 'approved' : 'rejected', note } : { type: 'review-report', reportId: record.id, status: approve ? 'accepted' : 'dismissed', note },
    success: 'La resolución quedó registrada en la demo.',
  })
  return <div className="admin-detail"><PageTitle title={appeal ? 'Revisión de cuenta' : 'Reporte de publicación'} back={{ to: backPath(location.state, `/admin/moderacion${appeal ? '?vista=apelaciones' : ''}`), label: 'Moderación' }} />
    <Badge status={record.status} /><dl className="admin-facts"><div><dt>Enviado por</dt><dd>{member?.name ?? 'Perfil no disponible'}</dd></div><div><dt>Fecha</dt><dd>{formatDateTime(record.createdAt)}</dd></div>{'reason' in record && <div><dt>Motivo</dt><dd>{record.reason}</dd></div>}{appeal && member && <div><dt>Estado de la cuenta</dt><dd><Badge status={member.status} /></dd></div>}</dl>
    {appeal && member?.suspensionReason && <p className="inline-notice">{member.suspensionReason}</p>}
    <section className="review-description"><h2>{appeal ? 'Solicitud de revisión' : 'Información del reporte'}</h2><p>{record.description}</p></section>
    {post && <Link className="review-work" to={`/obra/${post.id}`} state={{ from: location.pathname + location.search }}><img src={post.kind === 'audio' ? post.cover || '/media/sonido.svg' : post.src} alt="" /><span><strong>{post.title}</strong><Badge status={post.status} /></span><ArrowRight size={20} aria-hidden="true" /></Link>}
    {record.status === 'pending' ? <div className="form-actions"><Button variant="secondary" onClick={() => resolve(false)}><X size={18} aria-hidden="true" />{appeal ? 'Rechazar apelación' : 'Desestimar reporte'}</Button><Button onClick={() => resolve(true)}><Check size={18} aria-hidden="true" />{appeal ? 'Aceptar apelación' : 'Aceptar reporte'}</Button></div> : <Resolution record={record} />}
    {confirmation && <CommandDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />}
  </div>
}

export function AdminReportPage() { return <ReviewPage /> }
export function AdminAppealPage() { return <ReviewPage appeal /> }

export function AdminRequestsPage() {
  const { state } = useDemo()
  const location = useLocation()
  const { query, status, update } = useFilters('pending')
  const requests = state.requests.filter(request => (status === 'todos' || request.status === status) && normalize(`${request.title} ${request.description} ${request.discipline}`).includes(normalize(query)))
  return <><PageTitle title="Solicitudes" description="Propuestas de desafíos enviadas por la comunidad." />
    <div className="filter-row"><SearchField label="Buscar propuestas" value={query} onChange={value => update({ q: value })} /><SelectField label="Estado" options={reviewStatuses} value={status} onChange={event => update({ estado: event.target.value })} /></div>
    <p className="filter-summary" role="status">{requests.length} propuestas</p>
    {requests.length ? <AdminTable label="Propuestas de la comunidad" columns={['Propuesta', 'Autoría', 'Estado', 'Fecha', 'Acción']}>{requests.map(request => <tr key={request.id}>
      <th scope="row"><Link className="table-title" to={`/admin/solicitudes/${request.id}`} state={{ from: location.pathname + location.search }}>{request.title}</Link><small className="meta">{request.discipline}</small></th>
      <td>{state.users.find(member => member.id === request.authorId)?.name}</td><td><Badge status={request.status} /></td><td className="date-cell">{formatDate(request.createdAt)}</td><td><Link className="icon-button" to={`/admin/solicitudes/${request.id}`} state={{ from: location.pathname + location.search }} aria-label={`Revisar ${request.title}`} title="Abrir propuesta"><ArrowRight size={21} aria-hidden="true" /></Link></td>
    </tr>)}</AdminTable> : <EmptyState title="No hay propuestas en esta selección" description="Podés cambiar los filtros o volver más adelante." />}
  </>
}

export function AdminRequestPage() {
  const { state } = useDemo()
  const { id } = useParams()
  const location = useLocation()
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const request = state.requests.find(item => item.id === id)
  if (!request) return <EmptyState title="Esta propuesta no está disponible" description="Revisá el enlace o volvé al listado de solicitudes." action={<Link className="button button-secondary" to="/admin/solicitudes">Ver solicitudes</Link>} />
  const challenge = state.challenges.find(item => item.requestId === request.id)
  const review = (approve: boolean) => setConfirmation({ title: approve ? 'Aprobar esta propuesta' : 'Rechazar esta propuesta', description: approve ? 'La aprobación no publica un desafío. Después deberás definir sus fechas, formatos y portada.' : 'La persona podrá consultar el motivo. Esta propuesta no se podrá volver a resolver.', label: approve ? 'Aprobar propuesta' : 'Rechazar propuesta', reason: true,
    command: note => ({ type: 'review-request', requestId: request.id, status: approve ? 'approved' : 'rejected', note }), success: 'La propuesta quedó revisada.' })
  return <div className="admin-detail"><PageTitle title={request.title} back={{ to: backPath(location.state, '/admin/solicitudes'), label: 'Solicitudes' }} /><Badge status={request.status} />
    <dl className="admin-facts"><div><dt>Propuesta de</dt><dd>{state.users.find(member => member.id === request.authorId)?.name}</dd></div><div><dt>Disciplina</dt><dd>{request.discipline}</dd></div><div><dt>Fecha</dt><dd>{formatDateTime(request.createdAt)}</dd></div></dl>
    <section className="review-description"><h2>La idea</h2><p>{request.description}</p></section>
    {request.status === 'pending' ? <div className="form-actions"><Button variant="secondary" onClick={() => review(false)}><X size={18} aria-hidden="true" />Rechazar propuesta</Button><Button onClick={() => review(true)}><Check size={18} aria-hidden="true" />Aprobar propuesta</Button></div> : <Resolution record={request} />}
    {request.status === 'approved' && <div className="approved-proposal"><p>{challenge ? 'Esta propuesta ya tiene un desafío asociado.' : 'Falta definir las fechas y publicar el desafío.'}</p><Link className="button button-primary" to={challenge ? `/admin/desafios/${challenge.id}/editar` : `/admin/desafios/nuevo?solicitud=${request.id}`}>{challenge ? 'Editar desafío' : 'Preparar desafío'}<ArrowRight size={18} aria-hidden="true" /></Link></div>}
    {confirmation && <CommandDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />}
  </div>
}

export function AdminAccessPage() {
  const { state, user } = useDemo()
  const { query, update } = useFilters()
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const users = state.users.filter(member => member.status === 'active' && normalize(`${member.name} ${member.handle}`).includes(normalize(query)))
  return <><PageTitle title="Accesos y roles" description="Solo las cuentas activas pueden cambiar de rol. No podés modificar el de tu propia sesión." />
    <p className="inline-notice">Estos permisos son de demostración. No reemplazan autorización ni autenticación de un servidor.</p>
    <div className="filter-row"><SearchField label="Buscar perfil para cambiar su rol" value={query} onChange={value => update({ q: value })} /></div>
    {users.length ? <AdminTable label="Roles de los perfiles activos" columns={['Perfil', 'Rol actual', 'Acción']}>{users.map(member => <tr key={member.id}><th scope="row"><div className="table-person"><Avatar user={member} size="medium" /><span>{member.name}<small>@{member.handle}</small></span></div></th><td><Badge status={member.role} /></td>
      <td><IconButton icon={ShieldCheck} label={`Cambiar rol de ${member.name}`} disabled={member.id === user?.id} onClick={() => setConfirmation({ title: 'Cambiar acceso de este perfil', description: member.role === 'artist' ? `${member.name} podrá administrar las obras, cuentas y desafíos de esta demo.` : `${member.name} dejará de tener acceso a administración y conservará su perfil de artista.`, label: member.role === 'artist' ? 'Dar acceso de administración' : 'Cambiar a artista', command: () => ({ type: 'change-role', userId: member.id, role: member.role === 'artist' ? 'admin' : 'artist' }), success: 'El rol se actualizó en la demo.' })} /></td>
    </tr>)}</AdminTable> : <EmptyState title="No hay perfiles activos con ese nombre" description="Probá otra búsqueda. Las cuentas suspendidas o eliminadas no pueden cambiar de rol." />}
    {confirmation && <CommandDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />}
  </>
}

export function AdminReportsPage() {
  const { state } = useDemo()
  const { query, params, update } = useFilters()
  const [error, setError] = useState('')
  const author = (id: string) => state.users.find(member => member.id === id)?.name ?? 'Perfil no disponible'
  const datasets: Record<string, { label: string; columns: string[]; rows: (string | number)[][] }> = {
    actividad: { label: 'Actividad administrativa', columns: ['Fecha', 'Responsable', 'Decisión', 'Referencia'], rows: state.audit.slice().reverse().map(entry => [formatDateTime(entry.createdAt), author(entry.actorId), entry.label, entry.targetId]) },
    usuarios: { label: 'Perfiles', columns: ['Nombre', 'Usuario', 'Rol', 'Estado', 'Alta'], rows: state.users.map(member => [member.name, member.handle, statusLabels[member.role], statusLabels[member.status], formatDate(member.joinedAt)]) },
    publicaciones: { label: 'Publicaciones', columns: ['Título', 'Autoría', 'Medio', 'Estado', 'Me gusta', 'Comentarios'], rows: state.posts.map(post => [post.title, author(post.authorId), post.kind === 'image' ? 'Imagen' : 'Audio', post.status === 'published' && !state.users.some(member => member.id === post.authorId && member.status === 'active') ? 'Cuenta no activa' : statusLabels[post.status], post.likes.length, post.comments.length]) },
    desafios: { label: 'Desafíos', columns: ['Consigna', 'Estado', 'Inicio', 'Cierre'], rows: state.challenges.map(challenge => [challenge.title, statusLabels[challengeStatus(challenge)], formatDateTime(challenge.startsAt), formatDateTime(challenge.endsAt)]) },
    reportes: { label: 'Reportes de moderación', columns: ['Referencia', 'Publicación', 'Motivo', 'Estado', 'Resolución'], rows: state.reports.map(report => [report.id, state.posts.find(post => post.id === report.postId)?.title ?? report.postId, report.reason, statusLabels[report.status], report.note]) },
    propuestas: { label: 'Propuestas', columns: ['Título', 'Autoría', 'Disciplina', 'Estado', 'Resolución'], rows: state.requests.map(request => [request.title, author(request.authorId), request.discipline, statusLabels[request.status], request.note]) },
  }
  const requested = params.get('datos') ?? 'actividad'
  const selection = Object.hasOwn(datasets, requested) ? requested : 'actividad'
  const dataset = datasets[selection]
  const rows = dataset.rows.filter(row => normalize(row.join(' ')).includes(normalize(query)))
  const download = () => {
    setError('')
    try {
      const url = URL.createObjectURL(new Blob([toCsv([dataset.columns, ...rows])], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `trama-${selection}.csv`
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (failure) { console.error('[Trama demo] No se pudo generar el CSV.', failure); setError(errorMessage(failure)) }
  }
  return <><PageTitle title="Reportes y actividad" description="Datos del estado local actual, sin estadísticas de servidor ni métricas estimadas." actions={<Button variant="secondary" onClick={download} disabled={!rows.length}><Download size={18} aria-hidden="true" />Exportar CSV</Button>} />
    <div className="filter-row"><SelectField label="Contenido" value={selection} options={Object.entries(datasets).map(([value, data]) => ({ value, label: data.label }))} onChange={event => update({ datos: event.target.value, q: '' })} /><SearchField label="Filtrar filas del reporte" value={query} onChange={value => update({ q: value })} /></div>
    <p className="filter-summary" role="status">{rows.length} filas · La exportación incluye esta selección. Fechas de Buenos Aires (UTC−3).</p><ErrorMessage message={error} />
    {rows.length ? <AdminTable label={dataset.label} columns={dataset.columns}>{rows.map((row, index) => <tr key={index}>{row.map((cell, column) => column === 0 ? <th scope="row" key={column}>{cell}</th> : <td key={column}>{cell}</td>)}</tr>)}</AdminTable> : <EmptyState title="No hay datos en esta selección" description="Elegí otro contenido o quitá el filtro. La actividad aparece después de realizar decisiones administrativas." />}
  </>
}