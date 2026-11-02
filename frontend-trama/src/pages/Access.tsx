import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Eye, EyeOff, ShieldCheck, UserRound } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAction, useDemo } from '../context/DemoContext'
import { errorMessage, newId } from '../data/store'
import { safeReturnPath } from '../lib/format'
import { Brand } from '../components/Brand'
import { Button, ErrorMessage, Field, IconButton } from '../components/UI'

export function AccessPage({ register = false }: { register?: boolean }) {
  const { state, login } = useDemo()
  const action = useAction()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const admin = params.get('modo') === 'admin' && !register
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const enter = async (id: string) => {
    const user = await login(id)
    setPassword('')
    navigate(user.status === 'suspended' ? '/apelacion' : safeReturnPath(params.get('volver'), user.role === 'admin' ? '/admin/resumen' : '/inicio'), { replace: true })
  }
  const demo = async (id: string) => {
    setPending(true)
    setError('')
    try { await enter(id) } catch (failure) { console.error('[Trama demo] No se pudo ingresar.', failure); setError(errorMessage(failure)) } finally { setPending(false) }
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (password.length < 8) { setError('La contraseña de muestra debe tener al menos 8 caracteres. No uses una real.'); return }
    setPending(true)
    try {
      if (register) {
        const id = newId('artista')
        const result = await action.run({ type: 'create-account', user: { id, name, handle, email } })
        if (!result) return
        try { await login(id) } catch (failure) {
          console.error('[Trama demo] Perfil creado, sesión no disponible.', failure)
          setError('Tu perfil local se creó, pero no pudimos abrir la sesión. Intentá ingresar desde la pantalla de acceso.')
          return
        }
        setPassword('')
        navigate('/cuestionario', { replace: true })
      } else {
        const candidate = state.users.find(user => user.email.toLowerCase() === email.trim().toLowerCase() && user.status !== 'deleted')
        if (!candidate) throw new Error('No encontramos ese perfil en este navegador. Crealo desde Registro o elegí un perfil de ejemplo.')
        if (admin && candidate.role !== 'admin') throw new Error('Este perfil no tiene acceso a administración. Podés ingresar como artista.')
        await enter(candidate.id)
      }
    } catch (failure) {
      console.error('[Trama demo] No se pudo ingresar.', failure)
      setError(errorMessage(failure))
    } finally { setPending(false) }
  }

  return <div className="auth-page">
    <header className="auth-header"><Link to="/inicio" aria-label="Trama, ir al inicio"><Brand /></Link><Link className="back-link" to="/inicio"><ArrowLeft size={17} aria-hidden="true" />Explorar la comunidad</Link></header>
    <main className="auth-grid">
      <section className="auth-form">
        <h1>{register ? 'Crear perfil' : admin ? 'Ingresar a administración' : 'Ingresar'}</h1>
        <form className="form-stack" onSubmit={event => void submit(event)}>
          {register && <>
            <Field label="Nombre visible" value={name} onChange={event => setName(event.target.value)} autoComplete="nickname" required minLength={2} maxLength={80} placeholder="Cómo te gusta que te llamen" />
            <Field label="Nombre de usuario" value={handle} onChange={event => setHandle(event.target.value.toLowerCase())} autoComplete="username" required pattern="[a-z0-9._]{3,24}" maxLength={24} hint="Entre 3 y 24 letras, números, puntos o guiones bajos." placeholder="tu.nombre" />
          </>}
          <Field label="Correo del perfil de demo" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required maxLength={254} placeholder={admin ? 'admin@trama.demo' : 'mora@trama.demo'} />
          <div className="password-field">
            <Field label="Contraseña de muestra" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete={register ? 'new-password' : 'current-password'} required minLength={8}
              hint="Cualquier texto de 8 o más caracteres. No se verifica ni se guarda: no uses una contraseña real." />
            <IconButton icon={showPassword ? EyeOff : Eye} label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword(value => !value)} />
          </div>
          {!register && <Link className="text-link recovery-link" to="/recuperar">Sobre el acceso en esta demo</Link>}
          <ErrorMessage message={error || action.error} />
          <Button type="submit" className="full-width" loading={pending || action.pending}>{register ? 'Crear perfil local' : 'Ingresar'}</Button>
        </form>
        <p className="auth-switch">{register ? '¿Ya tenés un perfil?' : '¿Primera vez por acá?'} <Link to={register ? '/ingresar' : '/registro'}>{register ? 'Ingresá' : 'Creá tu perfil'}</Link></p>
        <div className="demo-shortcuts"><p>Perfiles de ejemplo</p><div className="demo-shortcut-buttons">
          <Button variant="secondary" disabled={pending || action.pending} onClick={() => void demo('mora')}><UserRound size={18} aria-hidden="true" />Como artista</Button>
          <Button variant="secondary" disabled={pending || action.pending} onClick={() => void demo('admin')}><ShieldCheck size={18} aria-hidden="true" />Como admin</Button>
        </div></div>
        <p className="auth-disclaimer">Solo demostración. No crea cuentas reales ni envía correos. Usá datos de ejemplo.</p>
      </section>
      <aside className="auth-art" aria-label="Una muestra de la comunidad">
        <div className="auth-art-grid">
          <div className="auth-art-main"><img src="/media/corriente.jpg" alt="Referencia de una pintura abstracta en colores vivos." width="900" height="1140" /></div>
          <img className="auth-art-second" src="/media/linea.svg" alt="Ilustración original de un retrato con líneas sobre papel." width="800" height="1040" />
          <img className="auth-art-third" src="/media/objetos.svg" alt="Ilustración de dos piezas de cerámica y una rama." width="900" height="800" />
        </div>
        <small>Contenido de ejemplo. Fotografías e ilustraciones con sus créditos en la demo.</small>
      </aside>
    </main>
    <footer className="auth-footer"><span>Trama · Comunidad para artistas</span><Link to="/acerca">Cómo funciona esta demostración</Link></footer>
  </div>
}

export function RecoveryPage() {
  return <main className="startup"><Brand /><h1>El acceso en esta demo</h1><p>Trama todavía no está conectado a un servicio de autenticación. Por eso no guardamos ni recuperamos contraseñas, y no enviamos enlaces por correo.</p>
    <p>Podés entrar con un perfil de ejemplo en un clic, o usar el correo de un perfil que hayas creado en este navegador y una contraseña de muestra de al menos 8 caracteres.</p>
    <Link className="button button-primary" to="/ingresar">Volver a Ingresar</Link><Link className="text-link" to="/inicio">Seguir explorando</Link>
  </main>
}

export function LogoutPage() {
  const { logout } = useDemo()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  useEffect(() => {
    try { logout(); navigate('/ingresar', { replace: true }) } catch (failure) {
      console.error('[Trama demo] No se pudo cerrar la sesión.', failure)
      setError('No pudimos cerrar la sesión de demo. Revisá los permisos de almacenamiento del navegador.')
    }
  }, [logout, navigate])
  return <main className="startup"><Brand /><h1>Cerrando tu sesión</h1><ErrorMessage message={error} /><Link className="text-link" to="/inicio">Volver a Inicio</Link></main>
}
