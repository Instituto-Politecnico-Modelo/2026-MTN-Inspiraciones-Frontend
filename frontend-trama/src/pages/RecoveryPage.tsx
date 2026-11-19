import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { Button, ErrorMessage, Field, IconButton } from '../components/UI'
import { useDemo } from '../context/DemoContext'
import { ApiError, passwordReset } from '../data/api'

const cooldownSeconds = 60
const passwordPattern = /^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/
const passwordHint = 'Usá al menos 8 caracteres, con una letra, un número y un carácter especial.'

export function RecoveryPage() {
  const { logout } = useDemo()
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [repeated, setRepeated] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState<'request' | 'confirm' | null>(null)
  const active = useRef<symbol | undefined>(undefined)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [repeatError, setRepeatError] = useState('')
  const [unusable, setUnusable] = useState(false)
  const [unknown, setUnknown] = useState(false)
  const [confirmationLimited, setConfirmationLimited] = useState(false)
  const [deadline, setDeadline] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const title = useRef<HTMLHeadingElement>(null)
  const emailInput = useRef<HTMLFormElement>(null)

  useEffect(() => {
    title.current?.focus()
  }, [step])
  useEffect(() => () => { active.current = undefined }, [])
  useEffect(() => {
    if (!deadline) return
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setSeconds(left)
      if (left === 0) setDeadline(0)
    }
    const timer = window.setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [deadline])

  function waitFor(seconds: number) {
    setSeconds(seconds)
    setDeadline(Date.now() + seconds * 1000)
  }

  function clearCredentials() {
    setCode('')
    setPassword('')
    setRepeated('')
    setShowPassword(false)
    setPasswordError('')
    setRepeatError('')
  }

  function switchEmail() {
    active.current = undefined
    setPending(null)
    clearCredentials()
    setError('')
    setNotice('')
    setUnusable(false)
    setUnknown(false)
    setConfirmationLimited(false)
    setDeadline(0)
    setSeconds(0)
    setStep('email')
  }

  async function requestCode() {
    if (active.current || seconds > 0) return
    const operation = Symbol()
    active.current = operation
    setPending('request')
    setError('')
    try {
      await passwordReset.request(email.trim())
      if (active.current !== operation) return
      clearCredentials()
      setUnknown(false)
      setConfirmationLimited(false)
      setUnusable(false)
      waitFor(cooldownSeconds)
      setNotice(step === 'email'
        ? 'Si hay una cuenta activa con ese correo, vas a recibir un código para recuperar el acceso.'
        : 'Usá el último código que recibas.')
      setStep('code')
    } catch (failure) {
      if (active.current !== operation) return
      if (failure instanceof ApiError && failure.status === 429) {
        waitFor(failure.retryAfterSeconds ?? cooldownSeconds)
        setError('Esperá antes de solicitar otro código.')
      } else {
        setError(failure instanceof ApiError ? failure.message : 'No pudimos solicitar el código. Volvé a intentar.')
      }
    } finally {
      if (active.current === operation) {
        active.current = undefined
        setPending(null)
      }
    }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (active.current || unusable || unknown || (confirmationLimited && seconds > 0)) return
    setError('')
    setUnknown(false)
    setPasswordError(passwordPattern.test(password) ? '' : passwordHint)
    setRepeatError(repeated === password ? '' : 'Las contraseñas no coinciden.')
    if (!passwordPattern.test(password) || repeated !== password) return
    const operation = Symbol()
    active.current = operation
    setPending('confirm')
    try {
      await passwordReset.confirm({ email: email.trim(), code, newPassword: password })
      if (active.current !== operation) return
      clearCredentials()
      setNotice('')
      setStep('done')
      try { logout(true) } catch {
        setError('No pudimos borrar la sesión guardada. Cerrá sesión desde la aplicación o borrá los datos de este sitio.')
      }
    } catch (failure) {
      if (active.current !== operation) return
      if (failure instanceof ApiError && (failure.status === 0 || failure.status >= 500)) {
        clearCredentials()
        setUnknown(true)
        setError('No pudimos confirmar el resultado. Podés intentar ingresar con la contraseña nueva o solicitar otro código.')
      } else if (failure instanceof ApiError && failure.status === 429) {
        waitFor(failure.retryAfterSeconds ?? cooldownSeconds)
        setConfirmationLimited(true)
        setError('Esperá antes de volver a confirmar.')
      } else if (failure instanceof ApiError && (failure.code === 'OTP_EXPIRADO' || failure.code === 'OTP_AGOTADO' || failure.intentosRestantes === 0)) {
        setUnusable(true)
        setCode('')
        setError(failure.code === 'OTP_EXPIRADO' ? 'El código venció. Solicitá uno nuevo.' : 'Se agotaron los intentos. Solicitá un código nuevo.')
      } else if (failure instanceof ApiError && failure.code === 'OTP_INVALIDO') {
        setError(failure.intentosRestantes === undefined ? 'El código es incorrecto o ya no se puede usar.'
          : `El código es incorrecto. Intentos restantes: ${failure.intentosRestantes}.`)
      } else {
        setError(failure instanceof ApiError ? failure.message : 'No pudimos guardar la contraseña. Volvé a intentar.')
      }
    } finally {
      if (active.current === operation) {
        active.current = undefined
        setPending(null)
      }
    }
  }

  function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void requestCode()
  }

  return <div className="auth-page">
    <header className="auth-header"><Link to="/inicio" aria-label="Trama, ir al inicio"><Brand /></Link></header>
    <main className="auth-grid recovery-grid">
      <section className="auth-form recovery-form">
        <h1 ref={title} tabIndex={-1}>{step === 'code' ? 'Elegí una contraseña nueva'
          : step === 'done' ? 'Tu contraseña se actualizó' : 'Recuperar contraseña'}</h1>
        {notice && <p role="status">{notice}</p>}
        {step === 'email' && <form ref={emailInput} className="form-stack" onSubmit={submitEmail}>
          <p>Ingresá el correo de tu cuenta para solicitar un código.</p>
          <Field label="Correo" type="email" autoComplete="email" maxLength={254} required value={email}
            onChange={event => setEmail(event.target.value)} disabled={pending !== null} />
          <Button type="submit" loading={pending === 'request'} disabled={seconds > 0}>
            {seconds > 0 ? `Enviar en ${seconds} s` : 'Enviar código'}
          </Button>
          <Button variant="ghost" disabled={pending !== null} onClick={() => {
            if (emailInput.current?.reportValidity()) {
              setError('')
              setStep('code')
            }
          }}>Ya tengo un código</Button>
        </form>}
        {step === 'code' && <form className="form-stack" onSubmit={event => void confirm(event)}>
          <p className="recovery-email">{email.trim()} <button className="text-link" type="button" onClick={switchEmail}>Cambiar correo</button></p>
          <Field label="Código de seis dígitos" type="text" inputMode="numeric" autoComplete="one-time-code"
            pattern="[0-9]{6}" maxLength={6} required value={code} hint="El código vence a los diez minutos."
            onChange={event => setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))} />
          <div className="password-field">
            <Field label="Contraseña nueva" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
              value={password} required hint={passwordHint} error={passwordError}
              onChange={event => { setPassword(event.target.value); setPasswordError('') }} />
            <IconButton icon={showPassword ? EyeOff : Eye} active={showPassword}
              label={showPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'} onClick={() => setShowPassword(value => !value)} />
          </div>
          <Field label="Repetir contraseña" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
            value={repeated} required error={repeatError} onChange={event => { setRepeated(event.target.value); setRepeatError('') }} />
          <Button type="submit" loading={pending === 'confirm'}
            disabled={pending === 'request' || unusable || unknown || (confirmationLimited && seconds > 0)}>
            {confirmationLimited && seconds > 0 ? `Confirmar en ${seconds} s` : 'Guardar contraseña'}
          </Button>
          <Button variant="secondary" loading={pending === 'request'} disabled={pending === 'confirm' || seconds > 0}
            onClick={() => void requestCode()}>{seconds > 0 ? `Reenviar en ${seconds} s` : 'Reenviar código'}</Button>
        </form>}
        <ErrorMessage message={error} />
        {step === 'done' && <p role="status">Volvé a ingresar con la nueva contraseña.</p>}
        <Link className={step === 'done' || unknown ? 'button button-primary' : 'text-link'} to="/ingresar">
          {step === 'done' || unknown ? 'Ir a ingresar' : 'Volver a ingresar'}
        </Link>
      </section>
    </main>
  </div>
}
