import { useState } from 'react'
import { Bookmark, FolderLock, Grid2X2, LockKeyhole, LogOut, MapPin, MoreHorizontal, Pencil, Plus, ShieldCheck, SlidersHorizontal, Trash2, Trophy } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAction, useDemo } from '../context/DemoContext'
import type { Folder } from '../data/model'
import { canManage, newId, privateFolders, visiblePosts } from '../data/store'
import { Avatar, Button, EmptyState, ErrorMessage, Field, IconButton, Modal, PageTitle, Tabs } from '../components/UI'
import { FollowButton } from '../components/FollowButton'
import { PostGrid } from '../components/PostCard'
import { CommandDialog, type Confirmation } from '../components/CommandDialog'

function FolderNameDialog({ folder, onClose }: { folder?: Folder; onClose: () => void }) {
  const [name, setName] = useState(folder?.name ?? '')
  const { run, pending, error } = useAction()
  return <Modal open title={folder ? 'Cambiar nombre de la carpeta' : 'Nueva carpeta'} description="Solo vos podés ver estas referencias." onClose={onClose} busy={pending}>
    <form onSubmit={event => {
      event.preventDefault()
      void run(folder ? { type: 'rename-folder', folderId: folder.id, name } : { type: 'create-folder', id: newId('carpeta'), name }, folder ? 'Nombre de la carpeta actualizado.' : 'Tu carpeta privada está lista.').then(result => { if (result) onClose() })
    }}><Field label="Nombre de la carpeta" value={name} onChange={event => setName(event.target.value)} placeholder="Por ejemplo, luz y texturas" required maxLength={60} />
      <ErrorMessage message={error} /><div className="dialog-actions"><Button variant="secondary" onClick={onClose} disabled={pending}>Cancelar</Button><Button type="submit" loading={pending}>{folder ? 'Guardar nombre' : 'Crear carpeta'}</Button></div>
    </form>
  </Modal>
}

export function ProfilePage() {
  const { state, user } = useDemo()
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const profile = state.users.find(candidate => candidate.id === (id ?? user?.id) && candidate.status === 'active')
  if (!profile) return <EmptyState title="Este perfil no está disponible" description="Puede que el enlace no sea correcto o que el perfil ya no esté visible." action={<Link className="button button-secondary" to="/descubrir?tipo=artistas">Descubrir artistas</Link>} />
  const own = user?.id === profile.id
  const requested = params.get('vista') ?? 'obras'
  const tab = own && requested === 'guardados' ? 'guardados' : 'obras'
  const publicWorks = visiblePosts(state)
  const works = own ? state.posts.filter(post => post.authorId === profile.id && post.status !== 'deleted') : publicWorks.filter(post => post.authorId === profile.id)
  const folders = privateFolders(state, profile.id, user?.id ?? null)
  const publishedCount = publicWorks.filter(post => post.authorId === profile.id).length
  const followers = state.follows.filter(follow => follow.followingId === profile.id).length
  const following = state.follows.filter(follow => follow.followerId === profile.id).length
  return <>
    <section className="profile-heading">
      <Avatar user={profile} size="large" />
      <div className="profile-identity"><h1>{profile.name}</h1><p className="meta">@{profile.handle}</p><p className="profile-disciplines">{profile.disciplines.join(' · ') || 'Un espacio para empezar a crear'}</p>
        <div className="profile-counts"><span><strong>{publishedCount}</strong> {publishedCount === 1 ? 'obra' : 'obras'}</span><span><strong>{followers}</strong> {followers === 1 ? 'seguidor' : 'seguidores'}</span><span><strong>{following}</strong> {following === 1 ? 'seguido' : 'seguidos'}</span></div>
      </div>
      <div className="profile-actions">{own ? <><Link className="button button-secondary" to="/perfil/editar"><Pencil size={17} aria-hidden="true" />Editar perfil</Link><IconButton icon={MoreHorizontal} label="Opciones de tu perfil" onClick={() => setMenuOpen(true)} /></> : <FollowButton artist={profile} />}</div>
    </section>
    <section className="profile-bio" aria-label="Sobre mí">{profile.bio ? <p>{profile.bio}</p> : <p className="muted">{own ? 'Contá un poco sobre vos y sobre lo que te gusta crear desde Editar perfil.' : 'Este artista todavía no agregó una biografía.'}</p>}
      <div className="profile-links">{profile.location && <span><MapPin size={16} aria-hidden="true" />{profile.location}</span>}
        {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer">{profile.website.replace(/^https?:\/\//, '')}</a>}
      </div>
    </section>
    {requested !== tab && <p className="inline-notice"><LockKeyhole size={18} aria-hidden="true" />{requested === 'guardados' ? 'Los guardados son privados. En otros perfiles solo se muestran obras públicas.' : 'Esa pestaña no está disponible. Elegí una de las secciones del perfil.'}</p>}
    <Tabs label="Contenido del perfil" value={tab} onChange={value => setParams(value === 'guardados' ? { vista: value } : {}, { replace: true, preventScrollReset: true })}
      items={[{ value: 'obras', label: 'Obras', icon: Grid2X2 }, ...(own ? [{ value: 'guardados', label: 'Guardados', icon: Bookmark }] : [])]}>
      {tab === 'obras' ? works.length ? <PostGrid posts={works} compact /> : <EmptyState title={own ? 'Tu primera obra tiene un lugar acá' : 'Todavía no hay obras para mostrar'}
        description={own ? 'Compartí una imagen o un audio. También vale mostrar algo que todavía está en proceso.' : 'Cuando este artista publique, vas a encontrar sus creaciones en este espacio.'}
        action={own && <Link className="button button-primary" to="/publicar"><Plus size={18} aria-hidden="true" />Compartir una obra</Link>} />
        : <>
          <div className="section-heading"><p className="meta"><LockKeyhole size={16} aria-hidden="true" /> Solo vos podés ver tus carpetas</p><Button variant="secondary" onClick={() => setCreatingFolder(true)}><Plus size={18} aria-hidden="true" />Nueva carpeta</Button></div>
          {folders.length ? <div className="folder-grid">{folders.map(folder => {
            const previews = publicWorks.filter(post => folder.postIds.includes(post.id)).slice(0, 4)
            return <Link className="folder-card" key={folder.id} to={`/carpeta/${folder.id}`}><div className="folder-preview">
              {[0, 1, 2, 3].map(index => previews[index] ? <img key={index} src={previews[index].kind === 'audio' ? previews[index].cover || '/media/sonido.svg' : previews[index].src} alt="" /> : <span key={index}><FolderLock size={24} aria-hidden="true" /></span>)}
            </div><h2>{folder.name}</h2><p className="meta">{folder.postIds.length} {folder.postIds.length === 1 ? 'referencia guardada' : 'referencias guardadas'}</p></Link>
          })}</div> : <EmptyState icon={FolderLock} title="Dale un lugar a lo que te inspira" description="Creá carpetas privadas y guardá obras con el marcador que aparece en cada publicación." action={<Button onClick={() => setCreatingFolder(true)}>Crear mi primera carpeta</Button>} />}
        </>}
    </Tabs>
    {creatingFolder && <FolderNameDialog onClose={() => setCreatingFolder(false)} />}
    {menuOpen && <Modal open title="Tu perfil" onClose={() => setMenuOpen(false)}><nav className="profile-menu">
      <Link className="nav-item" to="/cuestionario"><SlidersHorizontal size={21} aria-hidden="true" />Editar intereses</Link>
      <Link className="nav-item" to="/desafios/mis-propuestas"><Trophy size={21} aria-hidden="true" />Mis propuestas de desafíos</Link>
      <Link className="nav-item" to={canManage(user) ? '/admin/resumen' : '/ingresar?modo=admin'}><ShieldCheck size={21} aria-hidden="true" />{canManage(user) ? 'Administración' : 'Probar la demo de administración'}</Link>
      <Link className="nav-item" to="/salir"><LogOut size={21} aria-hidden="true" />Cerrar sesión</Link>
    </nav></Modal>}
  </>
}

export function FolderPage() {
  const { state, user } = useDemo()
  const { id } = useParams()
  const navigate = useNavigate()
  const [renaming, setRenaming] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const folder = state.folders.find(candidate => candidate.id === id && candidate.ownerId === user?.id)
  if (!folder) return <EmptyState icon={FolderLock} title="Esta carpeta es privada o no está disponible" description="Solo la persona que creó una carpeta puede abrirla." action={<Link className="button button-secondary" to="/perfil?vista=guardados">Ir a mis guardados</Link>} />
  const posts = visiblePosts(state).filter(post => folder.postIds.includes(post.id))
  const unavailable = folder.postIds.length - posts.length
  return <>
    <PageTitle title={folder.name} back={{ to: '/perfil?vista=guardados', label: 'Mis guardados' }}
      actions={<><IconButton icon={Pencil} label="Cambiar nombre de la carpeta" onClick={() => setRenaming(true)} />
        <IconButton icon={Trash2} label="Eliminar carpeta" onClick={() => setConfirmation({ title: 'Eliminar esta carpeta', description: `Se eliminará «${folder.name}» de tus guardados. Las publicaciones originales no se borran.`, label: 'Eliminar carpeta', dangerous: true, command: () => ({ type: 'delete-folder', folderId: folder.id }), success: 'Carpeta eliminada.' })} /></>} />
    <p className="filter-summary"><LockKeyhole size={16} aria-hidden="true" /> Solo vos · {posts.length} {posts.length === 1 ? 'obra disponible' : 'obras disponibles'}</p>
    {!!unavailable && <p className="inline-notice">{unavailable} referencias ya no están disponibles públicamente. Las demás siguen guardadas.</p>}
    {posts.length ? <PostGrid posts={posts} compact /> : <EmptyState icon={Bookmark} title="Esta carpeta espera tus próximas ideas" description="Buscá una obra y usá el marcador para guardarla acá." action={<Link className="button button-primary" to="/descubrir">Encontrar inspiración</Link>} />}
    {renaming && <FolderNameDialog folder={folder} onClose={() => setRenaming(false)} />}
    {confirmation && <CommandDialog confirmation={confirmation} onClose={() => setConfirmation(null)} onDone={() => navigate('/perfil?vista=guardados')} />}
  </>
}
