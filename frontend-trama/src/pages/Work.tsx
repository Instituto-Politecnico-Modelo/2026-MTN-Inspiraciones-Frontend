import { useState } from 'react'
import { ArrowLeft, Flag, Pencil, Send, Trash2, Trophy } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAction, useDemo } from '../context/DemoContext'
import { reportReasons, type Post, type Report } from '../data/model'
import { canManage, newId, visiblePosts } from '../data/store'
import { backPath, formatDate, relativeDate } from '../lib/format'
import { Avatar, Badge, Button, EmptyState, ErrorMessage, IconButton, Modal, PageTitle, SelectField, TextArea } from '../components/UI'
import { ArtworkImage, AudioPlayer } from '../components/Media'
import { PostActions } from '../components/PostCard'
import { FollowButton } from '../components/FollowButton'
import { useAccountGate } from '../components/Shell'
import { CommandDialog, type Confirmation } from '../components/CommandDialog'

function ReportDialog({ post, onClose }: { post: Post; onClose: () => void }) {
  const { run, pending, error } = useAction()
  const [reason, setReason] = useState<Report['reason']>(reportReasons[0])
  const [description, setDescription] = useState('')
  return <Modal open title="Reportar publicación" description="Contanos qué debería revisar el equipo. El reporte queda registrado únicamente en esta demo." onClose={onClose} busy={pending}>
    <form className="form-stack" onSubmit={event => {
      event.preventDefault()
      void run({ type: 'create-report', report: { id: newId('reporte'), postId: post.id, reason, description } }, 'Reporte enviado a la moderación de la demo.').then(result => { if (result) onClose() })
    }}><SelectField label="Motivo" value={reason} options={reportReasons.map(value => ({ value, label: value }))} onChange={event => {
      const selected = reportReasons.find(value => value === event.target.value)
      if (selected) setReason(selected)
    }} /><TextArea label="Información para la revisión" value={description} onChange={event => setDescription(event.target.value)} required minLength={10} maxLength={1500} />
      <ErrorMessage message={error} /><div className="dialog-actions"><Button variant="secondary" onClick={onClose} disabled={pending}>Cancelar</Button><Button type="submit" loading={pending}>Enviar reporte</Button></div>
    </form>
  </Modal>
}

export function WorkPage() {
  const { state, user } = useDemo()
  const { id } = useParams()
  const post = state.posts.find(item => item.id === id)
  const allowed = post && (visiblePosts(state).some(item => item.id === post.id) || canManage(user) || (post.authorId === user?.id && post.status !== 'deleted'))
  if (!post || !allowed) return <EmptyState title="Esta obra no está disponible" description="El enlace puede haber cambiado o la publicación ya no es pública." action={<Link className="button button-secondary" to="/descubrir">Seguir descubriendo</Link>} />
  return <WorkDetail key={post.id} post={post} />
}

function WorkDetail({ post }: { post: Post }) {
  const { state, user } = useDemo()
  const location = useLocation()
  const navigate = useNavigate()
  const gate = useAccountGate()
  const { run, pending, error } = useAction()
  const [comment, setComment] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<(Confirmation & { destination?: string }) | null>(null)
  const author = state.users.find(artist => artist.id === post.authorId)
  const isPublic = visiblePosts(state).some(item => item.id === post.id)
  const challenge = state.challenges.find(item => item.id === post.challengeId)
  const returnTo = backPath(location.state, canManage(user) ? '/admin/publicaciones' : '/descubrir')
  if (!author) return <ErrorMessage message="No pudimos encontrar la autoría de esta publicación." />
  return <>
    <div className="work-topline"><Link className="back-link" to={returnTo}><ArrowLeft size={18} aria-hidden="true" />Volver</Link>
      <div className="button-row">{user?.id === author.id && post.status !== 'deleted' && <>
        <Link className="icon-button" to={`/obra/${post.id}/editar`} aria-label="Editar publicación" title="Editar publicación"><Pencil size={20} aria-hidden="true" /></Link>
        <IconButton icon={Trash2} label="Eliminar publicación" onClick={() => setConfirmation({ title: 'Eliminar publicación', description: `«${post.title}» dejará de aparecer en la demo. Esta acción no se puede deshacer sin reiniciar los datos.`, label: 'Eliminar publicación', dangerous: true, command: () => ({ type: 'delete-post', postId: post.id }), success: 'Publicación eliminada de la demo.', destination: '/perfil' })} />
      </>}
        {isPublic && user?.id !== author.id && <IconButton icon={Flag} label="Reportar publicación" onClick={() => { if (gate()) setReportOpen(true) }} />}</div>
    </div>
    {!isPublic && <p className="inline-notice"><Flag size={18} aria-hidden="true" />Esta obra no es pública. La podés consultar por ser su autor o por administrar la demo. <Badge status={post.status} /></p>}
    <div className="work-layout">
      <section className="work-visual" aria-label="Obra completa"><div className="work-image"><ArtworkImage post={post} eager decorative={post.kind === 'audio'} /></div>
        {post.kind === 'audio' && <AudioPlayer post={post} />}
        <div className="work-credit"><p>{post.credit}</p>{post.creditUrl && <a className="text-link" href={post.creditUrl} target="_blank" rel="noopener noreferrer">Ver imagen de referencia</a>}</div>
      </section>
      <section className="work-info">
        <div className="work-author"><Link className="artist-link" to={`/perfil/${author.id}`}><Avatar user={author} size="medium" /><span><strong>{author.name}</strong><small>@{author.handle}</small></span></Link>{author.status === 'active' && <FollowButton artist={author} />}</div>
        <h1>{post.title}</h1><p className="meta">{post.discipline}{post.technique ? ` · ${post.technique}` : ''} · {formatDate(post.createdAt)}</p>
        {post.description && <p className="work-description">{post.description}</p>}
        {isPublic && <PostActions post={post} />}
        {challenge && <Link className="work-challenge" to={`/desafios/${challenge.id}`}><Trophy size={22} aria-hidden="true" /><span>Parte del desafío<strong>{challenge.title}</strong></span></Link>}
        <dl className="work-facts"><div><dt>Licencia</dt><dd>{post.license || 'Licencia no informada'}</dd></div></dl>
        <details className="accessible-description"><summary>{post.kind === 'audio' ? 'Descripción del audio / transcripción' : 'Descripción accesible'}</summary><p>{post.alt}</p></details>
        <section className="comments-section" aria-labelledby="comentarios"><h2 id="comentarios">Conversación <span>{post.comments.length}</span></h2>
          {post.comments.length ? <ul className="comment-list">{post.comments.map(item => {
            const commenter = state.users.find(candidate => candidate.id === item.authorId)
            return <li key={item.id}><Avatar user={commenter ?? { name: 'Perfil no disponible', avatar: '' }} /><div className="comment-content"><div className="comment-heading">
              {commenter?.status === 'active' ? <Link to={`/perfil/${commenter.id}`}><strong>{commenter.name}</strong></Link> : <strong>Perfil no disponible</strong>}<span>{relativeDate(item.createdAt)}</span></div><p>{item.text}</p></div>
              {(item.authorId === user?.id || canManage(user)) && <IconButton icon={Trash2} label={`Eliminar comentario de ${commenter?.name ?? 'este perfil'}`} onClick={() => setConfirmation({ title: 'Eliminar comentario', description: 'El comentario se quitará de esta conversación local.', label: 'Eliminar comentario', dangerous: true, command: () => ({ type: 'delete-comment', postId: post.id, commentId: item.id }), success: 'Comentario eliminado.' })} />}
            </li>
          })}</ul> : <p className="muted">Todavía no hay comentarios.</p>}
          {isPublic && user?.status === 'active' ? <form className="comment-form" onSubmit={event => {
            event.preventDefault()
            void run({ type: 'add-comment', id: newId('comentario'), postId: post.id, text: comment }, 'Tu comentario se agregó.').then(result => { if (result) setComment('') })
          }}><TextArea label="Sumate a la conversación" placeholder="¿Qué te inspira esta obra?" value={comment} onChange={event => setComment(event.target.value)} required maxLength={1000} rows={3} />
            <ErrorMessage message={error} /><Button type="submit" loading={pending}><Send size={17} aria-hidden="true" />Comentar</Button></form>
            : isPublic && <p className="comment-login"><Link to={`/ingresar?volver=${encodeURIComponent(`/obra/${post.id}#comentarios`)}`}>Ingresá</Link> para sumarte a la conversación.</p>}
        </section>
      </section>
    </div>
    {reportOpen && <ReportDialog post={post} onClose={() => setReportOpen(false)} />}
    {confirmation && <CommandDialog confirmation={confirmation} onClose={() => setConfirmation(null)} onDone={() => { if (confirmation.destination) navigate(confirmation.destination) }} />}
  </>
}

export function MissingPage() {
  return <><PageTitle title="No encontramos esa página" /><EmptyState title="El enlace no está disponible" description="Podés volver a Inicio para seguir explorando." action={<Link className="button button-primary" to="/inicio">Ir a Inicio</Link>} /></>
}
