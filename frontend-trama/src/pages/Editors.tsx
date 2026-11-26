import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Camera, ImagePlus, Plus, Upload, X } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAction, useDemo } from '../context/DemoContext'
import { disciplines, type Post, type ProfileChanges, type User } from '../data/model'
import { challengeStatus, errorMessage, mediaAccept, newId, normalize } from '../data/store'
import { placesApi } from '../data/api'
import type { CatalogDiscipline, Coordinates } from '../data/places'
import { OwnTagsField } from '../components/PlaceFields'
import { PlacePicker } from '../components/PlacePicker'
import { GoogleButton } from '../components/GoogleButton'
import { readUpload, type Upload as UploadedMedia } from '../lib/upload'
import { Avatar, Button, Choice, EmptyState, ErrorMessage, Field, IconButton, PageTitle, SelectField, TextArea } from '../components/UI'
import { useUnsavedChanges } from '../components/UnsavedChanges'
import { ArtworkImage, AudioPlayer, mediaLabel, VideoPlayer } from '../components/Media'
import { LocationSettings } from '../components/LocationPreference'
import { getPosition } from '../lib/geolocation'
import { useDevicePermission } from '../lib/useDevicePermission'
const imageAccept = 'image/jpeg,image/png,image/webp'
const profileFields = (user: User): ProfileChanges => ({
  name: user.name, handle: user.handle, bio: user.bio, location: user.location, website: user.website, avatar: user.avatar, disciplines: user.disciplines,
})
const accountFields = (user: User) => ({ email: user.email, fechaNacimiento: user.fechaNacimiento ?? '' })

export function EditProfilePage() {
  const { user } = useDemo()
  return user ? <ProfileForm key={user.id} user={user} /> : <EmptyState title="Ingresá para editar tu perfil" description="Tu presentación artística se guarda en tu perfil." action={<Link to="/ingresar" className="button button-primary">Ingresar</Link>} />
}

function ProfileForm({ user }: { user: User }) {
  const [form, setForm] = useState(() => profileFields(user))
  const [account, setAccount] = useState(() => accountFields(user))
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [googleToken, setGoogleToken] = useState('')
  const [permission, refreshPermission] = useDevicePermission()
  // Pedirlo desde un botón es una acción del usuario; la app nunca lo solicita sola.
  const requestPermission = async () => { await getPosition().catch(() => undefined); refreshPermission() }
  const sinContrasena = user.sinContrasena === true
  const [initial] = useState(() => JSON.stringify({ ...profileFields(user), ...accountFields(user) }))
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { run, pending, error } = useAction()
  const dirty = JSON.stringify({ ...form, ...account }) !== initial || uploading || newPassword !== ''
  const guard = useUnsavedChanges(dirty, pending)
  const update = <K extends keyof ProfileChanges>(key: K, value: ProfileChanges[K]) => setForm(current => ({ ...current, [key]: value }))
  const emailChanged = account.email.trim().toLowerCase() !== user.email.toLowerCase()
  const passwordChanged = !sinContrasena && newPassword !== ''
  const accountChanged = emailChanged || passwordChanged || account.fechaNacimiento !== (user.fechaNacimiento ?? '')
  const currentRequired = !sinContrasena && (emailChanged || passwordChanged)
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
      const accountChanges = accountChanged ? {
        email: account.email.trim(), fechaNacimiento: account.fechaNacimiento,
        ...(!emailChanged ? {} : sinContrasena ? { googleIdToken: googleToken } : { contrasenaActual: currentPassword }),
        ...(passwordChanged ? { contrasenaActual: currentPassword, contrasenaNueva: newPassword } : {}),
      } : undefined
      void run({ type: 'update-profile', changes: form, account: accountChanges }, 'Tu perfil se actualizó.').then(result => { if (result) { guard.allow(); navigate('/perfil') } })
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
      <fieldset className="plain-fieldset"><legend>Cuenta</legend>
        <div className="form-columns">
          <Field label="Correo" type="email" required maxLength={254} autoComplete="email" value={account.email} onChange={event => setAccount(current => ({ ...current, email: event.target.value }))}
            hint={sinContrasena ? 'Lo usás para ingresar. Si lo cambiás, confirmá tu identidad con Google.' : 'Lo usás para ingresar. Si lo cambiás, pedimos tu contraseña actual.'} />
          <Field label="Fecha de nacimiento" type="date" max={new Date().toISOString().slice(0, 10)} value={account.fechaNacimiento}
            onChange={event => setAccount(current => ({ ...current, fechaNacimiento: event.target.value }))} hint="Opcional. No se muestra en tu perfil." />
        </div>
        {!sinContrasena && <div className="form-columns">
          <Field label="Contraseña actual" type="password" required={currentRequired} autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)}
            hint="Solo la pedimos si cambiás el correo o la contraseña." />
          <Field label="Nueva contraseña" type="password" minLength={8} maxLength={200} autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)}
            hint="Opcional. Mínimo 8 caracteres, con letras, números y un símbolo." />
        </div>}
        {!sinContrasena && <p className="field-hint"><Link className="text-link recovery-link" to="/recuperar">¿Olvidaste tu contraseña?</Link></p>}
        {emailChanged && sinContrasena && <div className="google-reconfirm">
          <p className="field-hint">Tu cuenta entra con Google y no tiene contraseña en Trama. Confirmá tu identidad con Google: su pantalla te pide la contraseña de tu cuenta de Google, y Trama no la recibe.</p>
          <GoogleButton onCredential={token => setGoogleToken(token)} />
          <p className="field-hint">{googleToken ? 'Identidad confirmada. Guardá los cambios en los próximos 5 minutos.' : 'Todavía no confirmaste tu identidad con Google.'}</p>
        </div>}
      </fieldset>
      <fieldset className="plain-fieldset"><legend>Ubicación para lugares cercanos</legend>
        <LocationSettings api={placesApi} permission={permission} requestPermission={requestPermission} />
      </fieldset>
      <ErrorMessage message={error} />
      <div className="form-actions"><Link className="button button-secondary" to="/perfil">Cancelar</Link><Button type="submit" loading={pending} disabled={uploading || !dirty || (emailChanged && sinContrasena && !googleToken)}>Guardar cambios</Button></div>
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
  const [tutorialUrl, setTutorialUrl] = useState(existing?.tutorialUrl ?? '')
  const [challengeId, setChallengeId] = useState(existing?.challengeId ?? initialChallenge)
  const [rights, setRights] = useState(!!existing)
  const [catalog, setCatalog] = useState<CatalogDiscipline[]>([])
  const [ownTags, setOwnTags] = useState<string[]>(existing?.ownTags ?? [])
  const [location, setLocation] = useState<Coordinates | null>(existing?.location ?? null)
  useEffect(() => {
    let active = true
    placesApi.catalog().then(items => { if (active) setCatalog(items) }).catch(() => undefined)
    return () => { active = false }
  }, [])
  const catalogDiscipline = catalog.find(item => normalize(item.nombre) === normalize(discipline))
  const techniqueOptions = catalogDiscipline ? [
    { value: '', label: 'Sin técnica' },
    ...catalogDiscipline.tecnicas.map(item => ({ value: item.nombre, label: item.nombre })),
    ...(technique && !catalogDiscipline.tecnicas.some(item => item.nombre === technique) ? [{ value: technique, label: technique }] : []),
  ] : null
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const uploadRequest = useRef(0)
  useEffect(() => () => { uploadRequest.current++ }, [])
  useEffect(() => {
    if (media?.file) return () => URL.revokeObjectURL(media.src)
  }, [media])
  const [initial] = useState(() => JSON.stringify([title, description, alt, discipline, technique, license, challengeId, ownTags, location]))
  const dirty = uploading || (!existing && !!media) || JSON.stringify([title, description, alt, discipline, technique, license, challengeId, ownTags, location]) !== initial
  const guard = useUnsavedChanges(dirty, pending)
  const openChallenges = state.challenges.filter(challenge => challengeStatus(challenge) === 'open')
  const pickedChallenge = state.challenges.find(challenge => challenge.id === challengeId)
  const invalidChallenge = !!challengeId && (!pickedChallenge || challengeStatus(pickedChallenge) !== 'open')
  const incompatibleChallenge = !existing && !!challengeId && !!media && media.kind !== 'image'
  const upload = async (file: File) => {
    if (pending) return
    const request = ++uploadRequest.current
    setUploadError(''); setUploading(true)
    try {
      const result = await readUpload(file)
      if (request !== uploadRequest.current) {
        if (result.file) URL.revokeObjectURL(result.src)
        return
      }
      setMedia(result)
    } catch (failure) {
      console.error('[Trama] No se pudo abrir el archivo.', failure)
      if (request === uploadRequest.current) setUploadError(errorMessage(failure))
    } finally { if (request === uploadRequest.current) setUploading(false) }
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!media || !rights) { setUploadError('Elegí un archivo y confirmá que podés compartirlo.'); return }
    if (incompatibleChallenge) return
    const changes = { title, description, alt, discipline, technique, license, location, ownTags }
    const id = existing?.id ?? newId('obra')
    const { file, ...mediaData } = media
    const result = await run(existing ? { type: 'update-post', postId: existing.id, changes } : {
      type: 'create-post',
      file,
      post: { id, ...changes, ...mediaData, cover: '', challengeId: challengeId || null, credit: `Obra compartida por ${user.name}.`, creditUrl: '', tutorialUrl: tutorialUrl.trim() },
    }, existing ? 'Los cambios de tu obra se guardaron.' : 'Tu obra se publicó.')
    if (result) { guard.allow(); navigate(`/obra/${resolveId(id)}`) }
  }
  const preview: Post | null = media ? { id: 'vista-previa', ...media, authorId: user.id, title: title || 'Vista previa', description, alt, discipline, technique, license, cover: existing?.cover || (media.kind === 'audio' ? '/media/sonido.svg' : ''), credit: '', creditUrl: '', createdAt: new Date().toISOString(), status: 'published', likes: [], comments: [], challengeId: null } : null
  return <>
    <PageTitle title={existing ? 'Editar publicación' : 'Publicar obra'} description={existing ? 'El archivo original no se modifica.' : undefined} back={{ to: existing ? `/obra/${existing.id}` : '/inicio', label: 'Volver' }} />
    <form className="publish-layout" onSubmit={event => void submit(event)}>
      <section className="publish-preview" aria-label="Archivo de la obra">
        {preview ? <><div className="publish-media">{preview.kind === 'video'
          ? <VideoPlayer key={preview.src} post={preview} eager />
          : <ArtworkImage key={preview.src} post={preview} eager decorative={preview.kind === 'audio'} />}</div>
          {preview.kind === 'audio' && <AudioPlayer key={preview.src} post={preview} />}
          {!existing && <Button className="full-width" variant="secondary" disabled={pending} loading={uploading} onClick={() => fileInput.current?.click()}><ImagePlus size={18} aria-hidden="true" />Elegir otro archivo</Button>}
          {media?.file && <p className="field-hint upload-filename">{mediaLabel[preview.kind]} · {media.file.name}</p>}
        </> : <div className="upload-target" onDragOver={event => event.preventDefault()} onDrop={event => {
          event.preventDefault()
          if (event.dataTransfer.files.length !== 1) { setUploadError('Elegí un solo archivo por publicación.'); return }
          void upload(event.dataTransfer.files[0])
        }}><Upload size={32} strokeWidth={1.5} aria-hidden="true" /><p>Imagen, audio o video</p>
          <Button onClick={() => fileInput.current?.click()} loading={uploading}><Plus size={19} aria-hidden="true" />Elegir archivo</Button>
          <small>JPG, PNG y WebP hasta 5 MB. MP3, WAV, OGG y M4A hasta 16 MB. MP4 y WebM hasta 64 MB.</small>
        </div>}
        <input ref={fileInput} type="file" hidden accept={mediaAccept} aria-label="Elegir archivo de la obra" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file) }} />
        <ErrorMessage message={uploadError} />
      </section>
      <div className="form-stack">
        <Field label="Título" value={title} onChange={event => setTitle(event.target.value)} required maxLength={120} placeholder="Dale un nombre a tu obra" />
        <TextArea label="Sobre esta obra (opcional)" value={description} onChange={event => setDescription(event.target.value)} maxLength={2500} placeholder="Contá qué te inspiró o cómo fue el proceso…" />
        <div className="form-columns"><SelectField label="Disciplina" value={discipline} onChange={event => {
          const option = disciplines.find(value => value === event.target.value)
          if (option) { setDiscipline(option); if (catalog.length) setTechnique('') }
          else setUploadError('Elegí una disciplina de la lista.')
        }} options={disciplines.map(value => ({ value, label: value }))} />
          {techniqueOptions ? <SelectField label="Técnica (opcional)" value={technique} onChange={event => setTechnique(event.target.value)} options={techniqueOptions} />
            : <Field label="Técnica (opcional)" value={technique} onChange={event => setTechnique(event.target.value)} maxLength={80} placeholder="Por ejemplo, acuarela" />}</div>
        <TextArea label={media && media.kind !== 'image' ? `Descripción del ${mediaLabel[media.kind].toLowerCase()} o transcripción` : 'Descripción accesible de la imagen'} value={alt} onChange={event => setAlt(event.target.value)} required maxLength={media && media.kind !== 'image' ? 1200 : 700}
          hint={media && media.kind !== 'image' ? 'Describí el contenido e incluí una transcripción si hay voz.' : 'Describí lo importante de la imagen para quienes no pueden verla. Hasta 700 caracteres.'} />
        <SelectField label="Licencia o derechos" value={license} onChange={event => setLicense(event.target.value)} options={Array.from(new Set(['Todos los derechos reservados', 'CC BY 4.0', 'CC0', 'Licencia no informada', ...(existing ? [existing.license] : [])])).map(value => ({ value, label: value }))} />
        {!existing && <><SelectField label="Desafío (opcional)" value={challengeId} onChange={event => setChallengeId(event.target.value)}
          options={[{ value: '', label: 'Publicar sin desafío' }, ...openChallenges.map(challenge => ({ value: challenge.id, label: challenge.title })), ...(invalidChallenge ? [{ value: challengeId, label: 'Desafío no disponible' }] : [])]} />
          {invalidChallenge && <ErrorMessage message="El desafío elegido no está abierto. Elegí otro o publicá sin asociar tu obra." />}
          {incompatibleChallenge && <ErrorMessage message="Las participaciones de desafíos admiten imágenes. Para compartir este archivo, elegí Publicar sin desafío." />}
          <Field label="Enlace a video tutorial (opcional)" type="url" value={tutorialUrl} onChange={event => setTutorialUrl(event.target.value)} maxLength={500} placeholder="https://..."
            hint="Si tu obra enseña una técnica, compartí el enlace al video. Se mostrará como tutorial en Descubrir." />
        </>}
        <OwnTagsField tags={ownTags} onChange={setOwnTags} />
        <PlacePicker value={location} onChange={setLocation} />
        <label className="check-row"><input type="checkbox" checked={rights} onChange={event => setRights(event.target.checked)} required /><span>Confirmo que tengo derecho a compartir este archivo.</span></label>
        <ErrorMessage message={error} />
        {!media && <p className="field-hint">Elegí un archivo para habilitar la publicación.</p>}
        <div className="form-actions"><Link className="button button-secondary" to={existing ? `/obra/${existing.id}` : '/inicio'}>Cancelar</Link><Button type="submit" loading={pending} disabled={!media || uploading || incompatibleChallenge || (!existing && invalidChallenge)}>{existing ? 'Guardar cambios' : 'Publicar obra'}</Button></div>
      </div>
    </form>{guard.dialog}
  </>
}
