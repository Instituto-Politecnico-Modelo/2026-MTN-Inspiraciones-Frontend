import { useRef, useState } from 'react'
import { ArrowRight, CalendarDays, Check, ImagePlus, Plus, Trophy } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAction, useDemo } from '../context/DemoContext'
import { disciplines, type Challenge, type Discipline } from '../data/model'
import { challengeStatus, errorMessage, newId, visiblePosts } from '../data/store'
import { backPath, formatDate, formatDateTime } from '../lib/format'
import { readUpload } from '../lib/upload'
import { Badge, Button, EmptyState, ErrorMessage, Field, Modal, PageTitle, SelectField, Tabs, TextArea } from '../components/UI'
import { PostGrid } from '../components/PostCard'
import { useAccountGate } from '../components/Shell'
import { useUnsavedChanges } from '../components/UnsavedChanges'

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const { state } = useDemo()
  const location = useLocation()
  const count = visiblePosts(state).filter(post => post.challengeId === challenge.id).length
  return <article className="challenge-card"><Link className="challenge-cover" to={`/desafios/${challenge.id}`} state={{ from: location.pathname + location.search }}><img src={challenge.cover} alt="" loading="lazy" /><Badge status={challengeStatus(challenge)} /></Link>
    <p className="meta">{challenge.disciplines.join(' · ')}</p><h2><Link to={`/desafios/${challenge.id}`} state={{ from: location.pathname + location.search }}>{challenge.title}</Link></h2>
    <p>{challenge.description.split('. ')[0]}.</p><div className="challenge-card-meta"><span><CalendarDays size={16} aria-hidden="true" />{formatDate(challenge.endsAt)}</span><span>{count} {count === 1 ? 'obra' : 'obras'}</span></div>
    <Link className="text-link" to={`/desafios/${challenge.id}`} state={{ from: location.pathname + location.search }}>Ver consigna <ArrowRight size={17} aria-hidden="true" /></Link>
  </article>
}

export function ChallengesPage() {
  const { state, user } = useDemo()
  const [params, setParams] = useSearchParams()
  const requested = params.get('estado') ?? 'open'
  const status = ['open', 'upcoming', 'closed'].includes(requested) ? requested : 'open'
  const filtered = state.challenges.filter(challenge => challengeStatus(challenge) === status)
  return <>
    <PageTitle title="Desafíos"
      actions={<><Link className="button button-secondary" to="/desafios/proponer"><Plus size={19} aria-hidden="true" />Proponer un desafío</Link>{user && <Link className="text-link" to="/desafios/mis-propuestas">Mis propuestas</Link>}</>} />
    {requested !== status && <ErrorMessage message="Ese estado no existe. Elegí Abiertos, Próximos o Finalizados." />}
    <Tabs value={status} label="Estado de los desafíos" onChange={value => setParams({ estado: value }, { replace: true, preventScrollReset: true })}
      items={[{ value: 'open', label: 'Abiertos' }, { value: 'upcoming', label: 'Próximos' }, { value: 'closed', label: 'Finalizados' }]}>
      {filtered.length ? <div className="challenge-grid">{filtered.map(challenge => <ChallengeCard key={challenge.id} challenge={challenge} />)}</div>
        : <EmptyState icon={Trophy} title="Todavía no hay desafíos en esta sección" description="Podés explorar las otras consignas o proponer una idea para la comunidad." action={<Link className="button button-secondary" to="/desafios/proponer">Proponer una idea</Link>} />}
    </Tabs>
  </>
}

export function ChallengeDetailPage() {
  const { state } = useDemo()
  const { id } = useParams()
  const challenge = state.challenges.find(item => item.id === id && !item.archived)
  return challenge ? <ChallengeDetail key={challenge.id} challenge={challenge} /> : <EmptyState icon={Trophy} title="Este desafío no está disponible" description="La consigna puede haber sido archivada o el enlace puede ser incorrecto." action={<Link className="button button-secondary" to="/desafios">Ver desafíos</Link>} />
}

function ChallengeDetail({ challenge }: { challenge: Challenge }) {
  const { state, user } = useDemo()
  const location = useLocation()
  const gate = useAccountGate()
  const { run, pending, error } = useAction()
  const [joining, setJoining] = useState(false)
  const [selected, setSelected] = useState('')
  const status = challengeStatus(challenge)
  const posts = visiblePosts(state).filter(post => post.challengeId === challenge.id)
  const mine = posts.filter(post => post.authorId === user?.id)
  const eligible = visiblePosts(state).filter(post => post.authorId === user?.id && !post.challengeId && challenge.kinds.includes(post.kind))
  return <>
    <PageTitle title={challenge.title} back={{ to: backPath(location.state, '/desafios'), label: 'Volver a los desafíos' }} />
    <section className="challenge-detail"><div className="challenge-detail-image"><img src={challenge.cover} alt={`Imagen de referencia para ${challenge.title}`} /></div>
      <div className="challenge-brief"><Badge status={status} /><h2>La consigna</h2><p>{challenge.description}</p>
        <dl><div><dt>Disciplinas</dt><dd>{challenge.disciplines.join(', ')}</dd></div><div><dt>Formatos</dt><dd>{challenge.kinds.map(kind => kind === 'image' ? 'Imagen' : 'Audio').join(' y ')}</dd></div>
          <div><dt>Inicio</dt><dd>{formatDateTime(challenge.startsAt)}</dd></div><div><dt>Cierre</dt><dd>{formatDateTime(challenge.endsAt)}</dd></div></dl>
        <p className="field-hint">Fechas en horario de Buenos Aires (UTC−3). Sin premios, jurados ni rankings.</p>
        {!!mine.length && <p className="participation-status"><Check size={19} aria-hidden="true" />Ya participás con {mine.length} {mine.length === 1 ? 'obra' : 'obras'}.</p>}
        {status === 'open' ? (mine.length ? null : <Button onClick={() => { if (gate()) setJoining(true) }}><Plus size={19} aria-hidden="true" />Quiero participar</Button>)
          : <p className="muted">{status === 'upcoming' ? 'Vas a poder participar cuando abra la convocatoria.' : 'Este desafío finalizó. Podés seguir explorando las obras de la comunidad.'}</p>}
      </div>
    </section>
    <div className="section-heading"><h2>Obras participantes</h2><span className="meta">{posts.length} {posts.length === 1 ? 'obra' : 'obras'}</span></div>
    {posts.length ? <div className="challenge-works"><PostGrid posts={posts} compact /></div> : <EmptyState icon={Trophy} title="La primera respuesta puede ser la tuya" description={status === 'open' ? 'Compartí una obra propia que dialogue con esta consigna.' : 'Todavía no hay obras para mostrar en este desafío.'} />}
    {joining && <Modal open title="Participar del desafío" description="Elegí una obra propia disponible o publicá una nueva. Se guarda como tu participación." onClose={() => setJoining(false)} busy={pending}>
      {eligible.length ? <form className="form-stack" onSubmit={event => {
        event.preventDefault()
        void run({ type: 'join-challenge', challengeId: challenge.id, postId: selected }, 'Tu obra se sumó al desafío.').then(result => { if (result) setJoining(false) })
      }}><SelectField label="Obra para participar" required value={selected} onChange={event => setSelected(event.target.value)} options={[{ value: '', label: 'Elegí una obra' }, ...eligible.map(post => ({ value: post.id, label: post.title }))]} />
        <ErrorMessage message={error} /><Button type="submit" loading={pending} disabled={!selected}>Sumar esta obra</Button>
      </form> : <p className="muted">No tenés obras disponibles del formato solicitado que no participen ya de otro desafío.</p>}
      <Link className="button button-secondary full-width new-challenge-work" to={`/publicar?desafio=${challenge.id}`}><Plus size={18} aria-hidden="true" />Publicar una nueva obra</Link>
    </Modal>}
  </>
}

export function ProposeChallengePage() {
  const { run, pending, error } = useAction()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [discipline, setDiscipline] = useState<Discipline>('Ilustración')
  const [cover, setCover] = useState('')
  const [coverError, setCoverError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const guard = useUnsavedChanges(!!(title || description || cover), pending)
  const pickCover = async (file: File) => {
    setCoverError('')
    try { setCover((await readUpload(file, true)).src) }
    catch (failure) { console.error('[Trama] Portada no disponible.', failure); setCoverError(errorMessage(failure)) }
  }
  return <div className="editor-page"><PageTitle title="Proponer un desafío" back={{ to: '/desafios', label: 'Desafíos' }} />
    <form className="form-stack profile-form" onSubmit={event => {
      event.preventDefault()
      void run({ type: 'create-request', request: { id: newId('solicitud'), title, description, discipline, ...(cover ? { cover } : {}) } }, 'Tu propuesta se envió a la administración.').then(result => { if (result) { guard.allow(); navigate('/desafios/mis-propuestas') } })
    }}><Field label="Título de la propuesta" value={title} onChange={event => setTitle(event.target.value)} required maxLength={120} />
      <SelectField label="Disciplina principal" value={discipline} options={disciplines.map(value => ({ value, label: value }))} onChange={event => {
        const option = disciplines.find(value => value === event.target.value)
        if (option) setDiscipline(option)
      }} /><TextArea label="¿Cuál sería la consigna?" value={description} onChange={event => setDescription(event.target.value)} required minLength={10} maxLength={3000} rows={6} hint="Describí qué te gustaría proponer y cómo podría participar la comunidad." />
      <div className="cover-upload">{cover && <img src={cover} alt="Portada elegida para la propuesta" />}
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="Elegir portada de la propuesta" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void pickCover(file) }} />
        <Button variant="secondary" onClick={() => fileInput.current?.click()}><ImagePlus size={18} aria-hidden="true" />{cover ? 'Cambiar portada' : 'Agregar portada (opcional)'}</Button>
        <p className="field-hint">JPG, PNG o WebP de hasta 8 MiB. Usá una imagen que tengas derecho a compartir.</p></div>
      <p className="inline-notice">La aprobación no publica automáticamente un desafío. El equipo revisa la propuesta y define las fechas por separado.</p>
      <ErrorMessage message={coverError || error} /><div className="form-actions"><Link className="button button-secondary" to="/desafios">Cancelar</Link><Button type="submit" loading={pending}>Enviar propuesta</Button></div>
    </form>{guard.dialog}</div>
}

export function MyProposalsPage() {
  const { state, user } = useDemo()
  const requests = state.requests.filter(request => request.authorId === user?.id)
  return <><PageTitle title="Mis propuestas" description="Seguí la revisión de las ideas que compartiste." back={{ to: '/desafios', label: 'Desafíos' }} actions={<Link className="button button-primary" to="/desafios/proponer"><Plus size={18} aria-hidden="true" />Nueva propuesta</Link>} />
    {requests.length ? <div className="proposal-list">{requests.map(request => {
      const published = state.challenges.find(challenge => challenge.requestId === request.id && !challenge.archived)
      return <article key={request.id}><div className="section-heading"><h2>{request.title}</h2><Badge status={request.status} /></div><p>{request.description}</p><p className="meta">{request.discipline} · Enviada el {formatDate(request.createdAt)}</p>
        {request.note && <p className="review-note"><strong>Respuesta del equipo:</strong> {request.note}</p>}{published && <Link className="text-link" to={`/desafios/${published.id}`}>Ver desafío publicado</Link>}
      </article>
    })}</div> : <EmptyState icon={Trophy} title="Todo puede empezar con una idea" description="Todavía no enviaste propuestas. Compartí una consigna que te gustaría explorar con otras personas." action={<Link className="button button-primary" to="/desafios/proponer">Proponer un desafío</Link>} />}</>
}

export function AppealPage() {
  const { appeal, notify } = useDemo()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [description, setDescription] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  return <div className="editor-page"><PageTitle title="Revisemos lo que pasó" description="Si tu cuenta fue suspendida, contanos qué debería revisar el equipo. Confirmá que sos vos con tu correo y tu contraseña." />
    {sent ? <p className="inline-notice"><Check size={20} aria-hidden="true" />Recibimos tu solicitud. El equipo la va a revisar y vas a poder ingresar si se acepta.</p> : <form className="form-stack profile-form" onSubmit={event => {
      event.preventDefault()
      setPending(true)
      setError('')
      appeal({ email: email.trim(), password, mensaje: description }).then(() => { setSent(true); setPassword(''); notify('Tu solicitud de revisión se envió.') })
        .catch((failure: unknown) => setError(errorMessage(failure))).finally(() => setPending(false))
    }}><Field label="Correo" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required maxLength={254} />
      <Field label="Contraseña" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required />
      <TextArea label="Contanos qué debería revisar el equipo" value={description} onChange={event => setDescription(event.target.value)} required minLength={10} maxLength={1500} /><ErrorMessage message={error} /><Button type="submit" loading={pending}>Solicitar revisión</Button></form>}
    <div className="button-row"><Link className="button button-secondary" to="/inicio">Volver a Inicio</Link><Link className="text-link" to="/ingresar">Ingresar</Link></div>
  </div>
}