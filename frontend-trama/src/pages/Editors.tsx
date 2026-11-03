import { useRef, useState, type FormEvent } from 'react'
import { Camera, ImagePlus, Plus, Upload, X } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAction, useDemo } from '../context/DemoContext'
import { disciplines, type Post, type ProfileChanges, type User } from '../data/model'
import { challengeStatus, errorMessage, newId } from '../data/store'
import { readUpload, type Upload as UploadedMedia } from '../lib/upload'
import { Avatar, Button, Choice, EmptyState, ErrorMessage, Field, IconButton, PageTitle, SelectField, TextArea } from '../components/UI'
import { useUnsavedChanges } from '../components/UnsavedChanges'
import { AudioPlayer } from '../components/Media'

const imageAccept = 'image/jpeg,image/png,image/webp'
const mediaAccept = `${imageAccept},audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/mp4`
const profileFields = (user: User): ProfileChanges => ({
  name: user.name, handle: user.handle, bio: user.bio, location: user.location, website: user.website, avatar: user.avatar, disciplines: user.disciplines,
})

export function EditProfilePage() {
  const { user } = useDemo()
  return user ? <ProfileForm key={user.id} user={user} /> : <EmptyState title="Ingresá para editar tu perfil" description="Tu presentación artística se guarda en tu perfil." action={<Link to="/ingresar" className="button button-primary">Ingresar</Link>} />
}

function ProfileForm({ user }: { user: User }) {
  const [form, setForm] = useState(() => profileFields(user))
  const [initial] = useState(() => JSON.stringify(profileFields(user)))
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { run, pending, error } = useAction()
  const dirty = JSON.stringify(form) !== initial || uploading
  const guard = useUnsavedChanges(dirty, pending)
  const update = <K extends keyof ProfileChanges>(key: K, value: ProfileChanges[K]) => setForm(current => ({ ...current, [key]: value }))
  const photo = async (file: File) => {
    setUploading(true); setUploadError('')
    try { const media = await readUpload(file, true); update('avatar', media.src) }
    catch (failure) { console.error('[Trama] No se pudo abrir la foto.', failure); setUploadError(errorMessage(failure)) }
    finally { setUploading(false) }
  }
  return <div className="editor-page">
    <PageTitle title="Editar perfil" description="Estos datos serán públicos." back={{ to: '/perfil', label: 'Volver a mi perfil' }} />
    <form className="form-stack profile-form" onSubmit={event => {
      event.preventDefault()
      void run({ type: 'update-profile', changes: form }, 'Tu perfil se actualizó.').then(result => { if (result) { guard.allow(); navigate('/perfil') } })
    }}>
      <div className="photo-editor"><Avatar user={{ name: form.name || user.name, avatar: form.avatar }} size="large" /><div>
        <input ref={fileInput} type="file" accept={imageAccept} hidden aria-label="Elegir foto de perfil" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void photo(file) }} />
        <div className="button-row"><Button variant="secondary" loading={uploading} disabled={pending} onClick={() => fileInput.current?.click()}><Camera size={18} aria-hidden="true" />Cambiar foto</Button>
          {form.avatar && <IconButton icon={X} label="Quitar foto de perfil" disabled={pending || uploading} onClick={() => update('avatar', '')} />}</div>
        <p className="field-hint">JPG, PNG o WebP, hasta 5 MB. Se mostrará con recorte circular.</p>
      </div></div>
      <ErrorMessage message={uploadError} />
      <div className="form-columns"><Field label="Nombre visible" required minLength={2} maxLength={80} value={form.name} onChange={event => update('name', event.target.value)} autoComplete="nickname" />
        <Field label="Nombre de usuario" required pattern="[a-z0-9._\-]{3,50}" maxLength={50} hint="Tu identificador público único, sin @. Entre 3 y 50 caracteres." value={form.handle} onChange={event => update('handle', event.target.value.toLowerCase())} /></div>
      <TextArea label="Sobre mí" value={form.bio} onChange={event => update('bio', event.target.value)} maxLength={500} hint={`${form.bio.length}/500 caracteres. Contá qué hacés, qué buscás o qué te inspira.`} />
      <fieldset className="plain-fieldset"><legend>Disciplinas</legend><div className="choice-grid compact">{disciplines.map(discipline => <Choice key={discipline} selected={form.disciplines.includes(discipline)}
        onClick={() => update('disciplines', form.disciplines.includes(discipline) ? form.disciplines.filter(value => value !== discipline) : [...form.disciplines, discipline])}>{discipline}</Choice>)}</div></fieldset>
      <Field label="Sitio web" type="url" value={form.website} onChange={event => update('website', event.target.value)} placeholder="https://tu-portfolio.com" maxLength={500} hint="Opcional. Compartí un enlace público, no una dirección privada." />
      <Field label="Ubicación pública" value={form.location} onChange={event => update('location', event.target.value)} maxLength={100} placeholder="Ciudad o región" hint="Opcional. No hace falta compartir tu domicilio." />
      <ErrorMessage message={error} />
      <div className="form-actions"><Link className="button button-secondary" to="/perfil">Cancelar</Link><Button type="submit" loading={pending} disabled={uploading || !dirty}>Guardar cambios</Button></div>
    </form>{guard.dialog}
  </div>
}

export function PublishPage() {
  const { state, user } = useDemo()
  const { id } = useParams()
  const [params] = useSearchParams()
  const existing = id ? state.posts.find(post => post.id === id && post.authorId === user?.id && post.status !== 'deleted') : undefined
  if (!user || (id && !existing)) return <EmptyState title="No podés editar esta publicación" description="Solo podés editar tus propias obras disponibles." action={<Link className="button button-secondary" to="/perfil">Volver a mi perfil</Link>} />
  return <PublishForm key={id ?? 'nueva'} user={user} existing={existing} initialChallenge={params.get('desafio') ?? ''} />
}

function PublishForm({ user, existing, initialChallenge }: { user: User; existing?: Post; initialChallenge: string }) {
  const { state, resolveId } = useDemo()
  const { run, pending, error } = useAction()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [media, setMedia] = useState<UploadedMedia | null>(existing ? { kind: existing.kind, src: existing.src, width: existing.width, height: existing.height, duration: existing.duration } : null)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [alt, setAlt] = useState(existing?.alt ?? '')
  const [discipline, setDiscipline] = useState<Post['discipline']>(existing?.discipline ?? 'Ilustración')
  const [technique, setTechnique] = useState(existing?.technique ?? '')
  const [license, setLicense] = useState(existing?.license ?? 'Todos los derechos reservados')
  const [challengeId, setChallengeId] = useState(existing?.challengeId ?? initialChallenge)
  const [rights, setRights] = useState(!!existing)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [initial] = useState(() => JSON.stringify([existing?.title ?? '', existing?.description ?? '', existing?.alt ?? '', existing?.discipline ?? 'Ilustración', existing?.technique ?? '', existing?.license ?? 'Todos los derechos reservados', existing?.challengeId ?? initialChallenge]))
  const dirty = uploading || (!existing && !!media) || JSON.stringify([title, description, alt, discipline, technique, license, challengeId]) !== initial
  const guard = useUnsavedChanges(dirty, pending)
  const openChallenges = state.challenges.filter(challenge => challengeStatus(challenge) === 'open')
  const pickedChallenge = state.challenges.find(challenge => challenge.id === challengeId)
  const invalidChallenge = !!challengeId && (!pickedChallenge || challengeStatus(pickedChallenge) !== 'open')
  const upload = async (file: File) => {
    setUploadError(''); setUploading(true)
    try {
      const result = await readUpload(file)
      if (result.kind === 'audio') throw new Error('Por ahora solo se pueden publicar imágenes.')
      setMedia(result)
    } catch (failure) {
      console.error('[Trama] No se pudo abrir el archivo.', failure)
      setUploadError(errorMessage(failure))
    } finally { setUploading(false) }
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!media || !rights) { setUploadError('Elegí un archivo y confirmá que podés compartirlo.'); return }
    const changes = { title, description, alt, discipline, technique, license }
    const id = existing?.id ?? newId('obra')
    const result = await run(existing ? { type: 'update-post', postId: existing.id, changes } : {
      type: 'create-post',
      post: { id, ...changes, ...media, cover: media.kind === 'audio' ? '/media/sonido.svg' : '', challengeId: challengeId || null, credit: `Obra compartida por ${user.name}.`, creditUrl: '' },
    }, existing ? 'Los cambios de tu obra se guardaron.' : 'Tu obra se publicó.')
    if (result) { guard.allow(); navigate(`/obra/${resolveId(id)}`) }
  }
  const preview: Post | null = media ? { id: 'vista-previa', ...media, authorId: user.id, title: title || 'Vista previa', description, alt, discipline, technique, license, cover: existing?.cover || (media.kind === 'audio' ? '/media/sonido.svg' : ''), credit: '', creditUrl: '', createdAt: new Date().toISOString(), status: 'published', likes: [], comments: [], challengeId: null } : null
  return <>
    <PageTitle title={existing ? 'Editar publicación' : 'Publicar obra'} description={existing ? 'El archivo original no se modifica.' : undefined} back={{ to: existing ? `/obra/${existing.id}` : '/inicio', label: 'Volver' }} />
    <form className="publish-layout" onSubmit={event => void submit(event)}>
      <section className="publish-preview" aria-label="Archivo de la obra">
        {preview ? <><div className="publish-media"><img src={preview.kind === 'audio' ? preview.cover : preview.src} alt={alt || 'Vista previa del archivo elegido'} width={preview.width} height={preview.height} /></div>
          {preview.kind === 'audio' && <AudioPlayer key={preview.src} post={preview} />}
          {!existing && <Button className="full-width" variant="secondary" disabled={pending} loading={uploading} onClick={() => fileInput.current?.click()}><ImagePlus size={18} aria-hidden="true" />Elegir otro archivo</Button>}
          <p className="field-hint">{preview.kind === 'audio' ? 'Audio' : 'Imagen'} listo para compartir.</p>
        </> : <div className="upload-target" onDragOver={event => event.preventDefault()} onDrop={event => {
          event.preventDefault()
          if (event.dataTransfer.files.length !== 1) { setUploadError('Elegí un solo archivo por publicación.'); return }
          void upload(event.dataTransfer.files[0])
        }}><Upload size={32} strokeWidth={1.5} aria-hidden="true" /><p>Imagen</p>
          <Button onClick={() => fileInput.current?.click()} loading={uploading}><Plus size={19} aria-hidden="true" />Elegir archivo</Button>
          <small>JPG, PNG o WebP: hasta 5 MB.</small>
        </div>}
        <input ref={fileInput} type="file" hidden accept={mediaAccept} aria-label="Elegir archivo de la obra" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file) }} />
        <ErrorMessage message={uploadError} />
      </section>
      <div className="form-stack">
        <Field label="Título" value={title} onChange={event => setTitle(event.target.value)} required maxLength={120} placeholder="Dale un nombre a tu obra" />
        <TextArea label="Sobre esta obra (opcional)" value={description} onChange={event => setDescription(event.target.value)} maxLength={2500} placeholder="Contá qué te inspiró o cómo fue el proceso…" />
        <div className="form-columns"><SelectField label="Disciplina" value={discipline} onChange={event => {
          const option = disciplines.find(value => value === event.target.value)
          if (option) setDiscipline(option)
          else setUploadError('Elegí una disciplina de la lista.')
        }} options={disciplines.map(value => ({ value, label: value }))} />
          <Field label="Técnica (opcional)" value={technique} onChange={event => setTechnique(event.target.value)} maxLength={80} placeholder="Por ejemplo, acuarela" /></div>
        <TextArea label={media?.kind === 'audio' ? 'Descripción del audio o transcripción' : 'Descripción accesible de la imagen'} value={alt} onChange={event => setAlt(event.target.value)} required maxLength={media?.kind === 'audio' ? 10000 : 700}
          hint={media?.kind === 'audio' ? 'Describí los sonidos. Si hay voz, incluí la transcripción. Hasta 10.000 caracteres.' : 'Describí lo importante de la imagen para quienes no pueden verla. Hasta 700 caracteres.'} />
        <SelectField label="Licencia o derechos" value={license} onChange={event => setLicense(event.target.value)} options={Array.from(new Set(['Todos los derechos reservados', 'CC BY 4.0', 'CC0', 'Licencia no informada', ...(existing ? [existing.license] : [])])).map(value => ({ value, label: value }))} />
        {!existing && <><SelectField label="Desafío (opcional)" value={challengeId} onChange={event => setChallengeId(event.target.value)}
          options={[{ value: '', label: 'Publicar sin desafío' }, ...openChallenges.map(challenge => ({ value: challenge.id, label: challenge.title })), ...(invalidChallenge ? [{ value: challengeId, label: 'Desafío no disponible' }] : [])]} />
          {invalidChallenge && <ErrorMessage message="El desafío elegido no está abierto. Elegí otro o publicá sin asociar tu obra." />}
        </>}
        <label className="check-row"><input type="checkbox" checked={rights} onChange={event => setRights(event.target.checked)} required /><span>Confirmo que tengo derecho a compartir este archivo.</span></label>
        <ErrorMessage message={error} />
        {!media && <p className="field-hint">Elegí un archivo para habilitar la publicación.</p>}
        <div className="form-actions"><Link className="button button-secondary" to={existing ? `/obra/${existing.id}` : '/inicio'}>Cancelar</Link><Button type="submit" loading={pending} disabled={!media || uploading || (!existing && invalidChallenge)}>{existing ? 'Guardar cambios' : 'Publicar obra'}</Button></div>
      </div>
    </form>{guard.dialog}
  </>
}
