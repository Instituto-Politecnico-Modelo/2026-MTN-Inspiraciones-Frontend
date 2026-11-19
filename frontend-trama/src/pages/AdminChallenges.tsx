import { useRef, useState, type FormEvent } from 'react'
import { Archive, Eye, ImagePlus, Pencil, Plus, RotateCcw } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CommandDialog, type Confirmation } from '../components/CommandDialog'
import { Badge, Button, Choice, EmptyState, ErrorMessage, Field, IconButton, PageTitle, SearchField, SelectField, TextArea } from '../components/UI'
import { useUnsavedChanges } from '../components/UnsavedChanges'
import { useAction, useDemo } from '../context/DemoContext'
import { disciplines, type Challenge, type Proposal } from '../data/model'
import { challengeStatus, errorMessage, newId, normalize } from '../data/store'
import { backPath, formatDateTime, fromLocalDateTime, toLocalDateTime } from '../lib/format'
import { readUpload } from '../lib/upload'

const covers = [
  { src: '/media/linea.svg', label: 'Líneas' },
  { src: '/media/objetos.svg', label: 'Objetos' },
  { src: '/media/botanica.svg', label: 'Botánica' },
  { src: '/media/sonido.svg', label: 'Sonidos' },
]

export function AdminChallengesPage() {
  const { state } = useDemo()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const query = params.get('q') ?? ''
  const status = params.get('estado') ?? 'todos'
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true, preventScrollReset: true })
  }
  const challenges = state.challenges.filter(challenge => (status === 'todos' || challengeStatus(challenge) === status) && normalize(`${challenge.title} ${challenge.description} ${challenge.disciplines.join(' ')}`).includes(normalize(query)))
  return <><PageTitle title="Desafíos" description="Consignas, fechas y formatos de participación de la comunidad." actions={<Link className="button button-primary" to="/admin/desafios/nuevo"><Plus size={18} aria-hidden="true" />Nuevo desafío</Link>} />
    <div className="filter-row"><SearchField label="Buscar desafíos" value={query} onChange={value => update('q', value)} /><SelectField label="Estado" value={status} onChange={event => update('estado', event.target.value)} options={[{ value: 'todos', label: 'Todos' }, { value: 'open', label: 'Abiertos' }, { value: 'upcoming', label: 'Próximos' }, { value: 'closed', label: 'Finalizados' }, { value: 'archived', label: 'Archivados' }]} /></div>
    <p className="filter-summary" role="status">{challenges.length} desafíos · Fechas de Buenos Aires (UTC−3).</p>
    {challenges.length ? <div className="table-scroll" role="region" aria-label="Desafíos" tabIndex={0}><table className="admin-table"><caption className="sr-only">Desafíos</caption><thead><tr>{['Consigna', 'Estado', 'Fechas', 'Formatos', 'Acciones'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>
      {challenges.map(challenge => <tr key={challenge.id}><th scope="row"><Link className="table-work" to={`/admin/desafios/${challenge.id}/editar`} state={{ from: location.pathname + location.search }}><img src={challenge.cover} alt="" /><span>{challenge.title}<small>{challenge.disciplines.join(' · ')}</small></span></Link></th><td><Badge status={challengeStatus(challenge)} /></td>
        <td><span className="date-cell">{formatDateTime(challenge.startsAt)}</span><br /><span className="date-cell">{formatDateTime(challenge.endsAt)}</span></td><td>{challenge.kinds.map(kind => kind === 'image' ? 'Imagen' : 'Audio').join(' y ')}</td>
        <td><div className="table-actions">{!challenge.archived && <Link className="icon-button" to={`/desafios/${challenge.id}`} state={{ from: location.pathname + location.search }} aria-label={`Ver ${challenge.title}`} title="Ver en la comunidad"><Eye size={21} aria-hidden="true" /></Link>}
          <Link className="icon-button" to={`/admin/desafios/${challenge.id}/editar`} state={{ from: location.pathname + location.search }} aria-label={`Editar ${challenge.title}`} title="Editar desafío"><Pencil size={21} aria-hidden="true" /></Link>
          <IconButton icon={challenge.archived ? RotateCcw : Archive} label={`${challenge.archived ? 'Restaurar' : 'Archivar'} ${challenge.title}`} onClick={() => setConfirmation({ title: challenge.archived ? 'Restaurar este desafío' : 'Archivar este desafío', description: challenge.archived ? 'La consigna volverá a ser pública. La participación dependerá de sus fechas.' : 'La consigna se ocultará, sin eliminar las obras participantes ni sus datos.', label: challenge.archived ? 'Restaurar desafío' : 'Archivar desafío', dangerous: !challenge.archived, command: () => ({ type: 'archive-challenge', challengeId: challenge.id, archived: !challenge.archived }), success: challenge.archived ? 'Desafío restaurado.' : 'Desafío archivado.' })} />
        </div></td></tr>)}
    </tbody></table></div> : <EmptyState title="No hay desafíos en esta selección" description="Probá otra búsqueda o consultá un estado diferente." />}
    {confirmation && <CommandDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />}
  </>
}

export function AdminChallengeEditorPage() {
  const { state } = useDemo()
  const { id } = useParams()
  const [params] = useSearchParams()
  const existing = state.challenges.find(challenge => challenge.id === id)
  const requestId = params.get('solicitud')
  const proposal = state.requests.find(request => request.id === requestId)
  if (id && !existing) return <EmptyState title="No encontramos ese desafío" description="Revisá el enlace o volvé al listado de consignas." action={<Link className="button button-secondary" to="/admin/desafios">Ver desafíos</Link>} />
  if (!id && requestId && (!proposal || proposal.status !== 'approved')) return <EmptyState title="Esta propuesta todavía no está aprobada" description="Revisá su estado antes de preparar un desafío a partir de ella." action={<Link className="button button-secondary" to="/admin/solicitudes">Ver solicitudes</Link>} />
  const linked = !id && proposal && state.challenges.find(challenge => challenge.requestId === proposal.id)
  if (linked) return <EmptyState title="Esta propuesta ya tiene un desafío" description="Podés editar su consigna, portada y fechas sin crear un duplicado." action={<Link className="button button-primary" to={`/admin/desafios/${linked.id}/editar`}>Editar desafío</Link>} />
  return <ChallengeForm key={id ?? requestId ?? 'nuevo'} existing={existing} proposal={proposal} />
}

type FormValues = Pick<Challenge, 'title' | 'description' | 'disciplines' | 'kinds' | 'cover' | 'startsAt' | 'endsAt'>

function ChallengeForm({ existing, proposal }: { existing?: Challenge; proposal?: Proposal }) {
  const { run, pending, error } = useAction()
  const navigate = useNavigate()
  const location = useLocation()
  const fileInput = useRef<HTMLInputElement>(null)
  const [id] = useState(() => existing?.id ?? newId('desafio'))
  const [initial] = useState<FormValues>(() => ({
    title: existing?.title ?? proposal?.title ?? '', description: existing?.description ?? proposal?.description ?? '',
    disciplines: existing?.disciplines ?? (proposal ? [proposal.discipline] : []), kinds: existing?.kinds ?? (proposal?.discipline === 'Música' ? ['audio'] : ['image']),
    cover: existing?.cover ?? (proposal?.discipline === 'Música' ? '/media/sonido.svg' : covers[0].src),
    startsAt: existing ? toLocalDateTime(existing.startsAt) : '', endsAt: existing ? toLocalDateTime(existing.endsAt) : '',
  }))
  const [form, setForm] = useState(initial)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const dirty = (['title', 'description', 'cover', 'startsAt', 'endsAt'] as const).some(key => form[key] !== initial[key]) || form.disciplines.join('|') !== initial.disciplines.join('|') || form.kinds.join('|') !== initial.kinds.join('|')
  const guard = useUnsavedChanges(dirty || uploading, pending || uploading)
  const destination = backPath(location.state, '/admin/desafios')
  const update = <Key extends keyof FormValues>(key: Key, value: FormValues[Key]) => setForm(current => ({ ...current, [key]: value }))
  const upload = async (file: File) => {
    setUploading(true)
    setUploadError('')
    try { update('cover', (await readUpload(file, true)).src) }
    catch (failure) { console.error('[Trama] Portada no disponible.', failure); setUploadError(errorMessage(failure)) }
    finally { setUploading(false) }
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setUploadError('')
    try {
      const result = await run({ type: 'save-challenge', challenge: { ...form, id, startsAt: fromLocalDateTime(form.startsAt), endsAt: fromLocalDateTime(form.endsAt), archived: existing?.archived ?? false, requestId: existing?.requestId ?? proposal?.id ?? null } }, existing ? 'Los cambios del desafío se guardaron.' : 'El desafío se publicó en la demo.')
      if (result) { guard.allow(); navigate(destination) }
    } catch (failure) { console.error('[Trama] Fechas no válidas.', failure); setUploadError('Revisá las fechas de inicio y cierre antes de publicar.') }
  }
  return <div className="editor-page"><PageTitle title={existing ? 'Editar desafío' : 'Nuevo desafío'} description="La consigna será pública y aceptará participaciones durante las fechas indicadas." back={{ to: destination, label: 'Desafíos' }} />
    {existing?.archived && <p className="inline-notice">Esta consigna está archivada. Guardar cambios no la vuelve a publicar.</p>}
    <form className="form-stack profile-form" onSubmit={event => void submit(event)}>
      {proposal && !existing && <p className="inline-notice">Propuesta aprobada de la comunidad. La publicación y sus fechas se confirman en este paso.</p>}
      <Field label="Título de la consigna" value={form.title} onChange={event => update('title', event.target.value)} required maxLength={120} />
      <TextArea label="Consigna y condiciones" value={form.description} onChange={event => update('description', event.target.value)} required minLength={10} maxLength={3000} rows={6} />
      <fieldset className="plain-fieldset"><legend>Disciplinas admitidas</legend><div className="choice-grid compact">{disciplines.map(discipline => <Choice key={discipline} selected={form.disciplines.includes(discipline)} onClick={() => update('disciplines', form.disciplines.includes(discipline) ? form.disciplines.filter(value => value !== discipline) : [...form.disciplines, discipline])}>{discipline}</Choice>)}</div></fieldset>
      <fieldset className="plain-fieldset"><legend>Formatos admitidos</legend><div className="choice-grid compact">{(['image', 'audio'] as const).map(kind => <Choice key={kind} selected={form.kinds.includes(kind)} onClick={() => update('kinds', form.kinds.includes(kind) ? form.kinds.filter(value => value !== kind) : [...form.kinds, kind])}>{kind === 'image' ? 'Imagen' : 'Audio'}</Choice>)}</div></fieldset>
      <div className="form-columns"><Field label="Inicio (Buenos Aires)" type="datetime-local" value={form.startsAt} onChange={event => update('startsAt', event.target.value)} required /><Field label="Cierre (Buenos Aires)" type="datetime-local" value={form.endsAt} onChange={event => update('endsAt', event.target.value)} required /></div>
      <p className="field-hint">Horario de Buenos Aires (UTC−3), independientemente de la zona horaria del dispositivo. El cierre debe ser posterior al inicio.</p>
      <fieldset className="plain-fieldset"><legend>Portada</legend><div className="cover-options">{covers.map(cover => <label key={cover.src} className={`cover-choice ${form.cover === cover.src ? 'is-selected' : ''}`}><img src={cover.src} alt="" /><span><input type="radio" name="portada" value={cover.src} checked={form.cover === cover.src} onChange={() => update('cover', cover.src)} />{cover.label}</span></label>)}</div></fieldset>
      {!covers.some(cover => cover.src === form.cover) && <div className="cover-upload"><img src={form.cover} alt="Portada elegida para el desafío" /><p className="meta">Portada elegida</p></div>}
      <div><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="Elegir portada del desafío" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file) }} />
        <Button variant="secondary" loading={uploading} disabled={pending} onClick={() => fileInput.current?.click()}><ImagePlus size={18} aria-hidden="true" />Elegir otra portada</Button><p className="field-hint">JPG, PNG o WebP de hasta 8 MiB. Usá una imagen que tengas derecho a compartir.</p></div>
      <ErrorMessage message={uploadError || error} /><div className="form-actions"><Link className="button button-secondary" to={destination}>Cancelar</Link><Button type="submit" loading={pending} disabled={uploading || (!!existing && !dirty)}>{existing ? 'Guardar cambios' : 'Publicar desafío'}</Button></div>
    </form>{guard.dialog}
  </div>
}