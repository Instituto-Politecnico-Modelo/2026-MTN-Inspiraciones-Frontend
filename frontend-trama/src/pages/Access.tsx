import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDemo } from '../context/DemoContext'
import { ApiError } from '../data/api'
import { errorMessage } from '../data/store'
import { safeReturnPath } from '../lib/format'
import { Brand } from '../components/Brand'
import { Button, ErrorMessage, Field, IconButton } from '../components/UI'

export function AccessPage({ register = false }: { register?: boolean }) {
  const { login, register: createAccount } = useDemo()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const admin = params.get('modo') === 'admin' && !register
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [suspended, setSuspended] = useState(false)
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuspended(false)
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    setPending(true)
    try {
      if (register) {
        await createAccount({ email: email.trim(), username: handle, nombreCompleto: name.trim(), password })
        setPassword('')
        navigate('/cuestionario', { replace: true })
      } else {
        const user = await login(email.trim(), password)
        if (admin && user.role !== 'admin') throw new Error('Este perfil no tiene acceso a administración. Podés ingresar como artista.')
        setPassword('')
        navigate(safeReturnPath(params.get('volver'), user.role === 'admin' ? '/admin/resumen' : '/inicio'), { replace: true })
      }
    } catch (failure) {
      console.error('[Trama] No se pudo ingresar.', failure)
      setSuspended(failure instanceof ApiError && failure.status === 403)
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
            <Field label="Nombre de usuario" value={handle} onChange={event => setHandle(event.target.value.toLowerCase())} autoComplete="username" required pattern="[a-z0-9._]{3,10}" maxLength={10} hint="Entre 3 y 10 letras, números, puntos o guiones bajos." placeholder="tu.nombre" />
          </>}
          <Field label="Correo" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required maxLength={254} />
          <div className="password-field">
            <Field label="Contraseña" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete={register ? 'new-password' : 'current-password'} required minLength={8}
              hint={register ? 'Usá al menos 8 caracteres.' : undefined} />
            <IconButton icon={showPassword ? EyeOff : Eye} label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword(value => !value)} />
          </div>
          {!register && <Link className="text-link recovery-link" to="/recuperar">¿Olvidaste tu contraseña?</Link>}
          <ErrorMessage message={error} />
          {suspended && <p className="field-hint">Si tu cuenta fue suspendida, podés <Link className="text-link" to="/apelacion">solicitar una revisión</Link>.</p>}
          <Button type="submit" className="full-width" loading={pending}>{register ? 'Crear perfil' : 'Ingresar'}</Button>
        </form>
        <p className="auth-switch">{register ? '¿Ya tenés un perfil?' : '¿Primera vez por acá?'} <Link to={register ? '/ingresar' : '/registro'}>{register ? 'Ingresá' : 'Creá tu perfil'}</Link></p>
      </section>
      <aside className="auth-art" aria-label="Una muestra de la comunidad">
        <div className="auth-art-grid">
          <div className="auth-art-main"><img src="/media/corriente.jpg" alt="Referencia de una pintura abstracta en colores vivos." width="900" height="1140" /></div>
          <img className="auth-art-second" src="/media/linea.svg" alt="Ilustración original de un retrato con líneas sobre papel." width="800" height="1040" />
          <img className="auth-art-third" src="/media/objetos.svg" alt="Ilustración de dos piezas de cerámica y una rama." width="900" height="800" />
        </div>
      </aside>
    </main>
    <footer className="auth-footer"><span>Trama · Comunidad para artistas</span><Link to="/acerca">Acerca de Trama</Link></footer>
  </div>
}

export function RecoveryPage() {
  return <main className="startup"><Brand /><h1>Recuperar el acceso</h1><p>Por ahora la recuperación de contraseña no está disponible desde Trama. Si no podés ingresar, escribile al equipo de administración para que restablezca tu acceso.</p>
    <Link className="button button-primary" to="/ingresar">Volver a Ingresar</Link><Link className="text-link" to="/inicio">Seguir explorando</Link>
  </main>
}
export function LogoutPage() {
  const { logout } = useDemo()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  useEffect(() => {
    try { logout(); navigate('/ingresar', { replace: true }) } catch (failure) {
      console.error('[Trama] No se pudo cerrar la sesión.', failure)
      setError('No pudimos cerrar la sesión. Revisá los permisos de almacenamiento del navegador.')
    }
  }, [logout, navigate])
  return <main className="startup"><Brand /><h1>Cerrando tu sesión</h1><ErrorMessage message={error} /><Link className="text-link" to="/inicio">Volver a Inicio</Link></main>
}
