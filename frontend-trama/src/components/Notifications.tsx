import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useDemo } from '../context/DemoContext'
import { getToken, notificationInbox, notificationPreferences, type InboxNotice, type NotificationPreference } from '../data/api'
import { disableNotifications, enableNotifications, listenNotifications, notificationsEnabled } from '../data/push'
import { isReportNotice, reportLink } from '../data/reportLinks'
import { errorMessage } from '../data/store'
import { Button, EmptyState, ErrorMessage, IconButton, Modal, PageTitle } from './UI'

const updatedEvent = 'trama-inbox-updated'
const inboxDestination = (notice: InboxNotice) => isReportNotice(notice.tipo)
  ? reportLink(notice.solicitudId)
  : notice.publicacionId ? `/obra/${encodeURIComponent(notice.publicacionId)}` : '/inicio'

function Inbox({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useDemo()
  const navigate = useNavigate()
  const [notices, setNotices] = useState<InboxNotice[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(0)
  const invalidate = useCallback(() => { request.current++ }, [])
  const userId = user?.id
  const refresh = useCallback(async () => {
    const current = ++request.current
    try {
      const result = await notificationInbox.list()
      if (current === request.current) { setNotices(result); setError('') }
    } catch (failure) {
      if (current === request.current) setError(errorMessage(failure))
    } finally { if (current === request.current) setLoading(false) }
  }, [])
  useEffect(() => {
    if (!userId) return
    void refresh()
    const update = () => { if (document.visibilityState !== 'hidden') void refresh() }
    window.addEventListener('focus', update)
    window.addEventListener('pageshow', update)
    window.addEventListener('online', update)
    window.addEventListener(updatedEvent, update)
    document.addEventListener('visibilitychange', update)
    const interval = window.setInterval(update, 30000)
    return () => {
      invalidate()
      window.clearInterval(interval)
      window.removeEventListener('focus', update)
      window.removeEventListener('pageshow', update)
      window.removeEventListener('online', update)
      window.removeEventListener(updatedEvent, update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [refresh, userId, invalidate])
  const read = async (notice?: InboxNotice, open = false) => {
    setPending(true)
    setError('')
    try {
      if (notice) await notificationInbox.read(notice.id)
      else await notificationInbox.readAll()
      request.current++
      setLoading(false)
      setNotices(previous => notice ? previous.filter(item => item.id !== notice.id) : [])
      window.dispatchEvent(new Event(updatedEvent))
      if (open && notice) {
        onNavigate?.()
        navigate(inboxDestination(notice))
      }
    } catch (failure) { setError(errorMessage(failure)) }
    finally { setPending(false) }
  }
  return <section aria-label="Notificaciones no vistas" aria-busy={loading || pending}>
    <div className="button-row">
      <Button variant="secondary" disabled={pending} onClick={() => void refresh()}>Actualizar</Button>
      {!!notices.length && <Button variant="ghost" disabled={pending} onClick={() => void read()}>Marcar todas como leídas</Button>}
    </div>
    <ErrorMessage message={error} />
    {error && <Button variant="secondary" onClick={() => void refresh()}>Reintentar</Button>}
    {loading ? <p role="status">Cargando notificaciones…</p> : notices.length ? <ul className="notification-list">
      {notices.map(notice => <li key={notice.id}>
        <Link to={inboxDestination(notice)} aria-disabled={pending || undefined}
          onClick={event => {
            if (!pending && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return
            event.preventDefault()
            if (!pending) void read(notice, true)
          }}>
          <strong>{notice.titulo}</strong><p>{notice.mensaje}</p>
        </Link>
        <Button variant="ghost" disabled={pending} aria-label={`Marcar como leída: ${notice.titulo}`} onClick={() => void read(notice)}>Marcar como leída</Button>
      </li>)}
    </ul> : !error && <EmptyState icon={Bell} title="No hay notificaciones nuevas" description="Los nuevos avisos de tu cuenta aparecerán acá." />}
  </section>
}

export function Notifications() {
  const { user, notify } = useDemo()
  const [open, setOpen] = useState(false)
  const seen = useRef(new Set<string>())
  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    return listenNotifications(userId, notice => {
      if (seen.current.has(notice.id)) return
      seen.current.add(notice.id)
      if (seen.current.size > 100) seen.current.delete(seen.current.values().next().value!)
      window.dispatchEvent(new Event(updatedEvent))
      notify(`${notice.title}: ${notice.body}`, 'info')
    })
  }, [userId, notify])
  useEffect(() => {
    if (!userId || !notificationsEnabled(userId)) return
    let active = true
    void enableNotifications(userId, getToken() ?? '').catch(failure => {
      if (active) notify(errorMessage(failure), 'error')
    })
    return () => { active = false }
  }, [userId, notify])
  return <>
    <IconButton icon={Bell} label="Notificaciones" onClick={() => setOpen(true)} />
    {open && <Modal open title="Notificaciones" onClose={() => setOpen(false)}>
      <div className="button-row">
        <Link className="button button-secondary" to="/notificaciones" onClick={() => setOpen(false)}>Ver todas las notificaciones</Link>
        <Link className="button button-ghost" to="/notificaciones/configuracion" onClick={() => setOpen(false)}>Ir a configuración</Link>
      </div>
      <Inbox onNavigate={() => setOpen(false)} />
    </Modal>}
  </>
}

export function NotificationsPage() {
  return <><PageTitle title="Notificaciones" description="Todos los avisos que todavía no viste."
    actions={<Link className="button button-secondary" to="/notificaciones/configuracion">Ir a configuración</Link>} /><Inbox /></>
}

export function NotificationSettingsPage() {
  const { user } = useDemo()
  const userId = user?.id
  const [enabled, setEnabled] = useState(() => !!user && notificationsEnabled(user.id))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [preferences, setPreferences] = useState<NotificationPreference[] | null>(null)
  const [preferenceError, setPreferenceError] = useState('')
  const [saving, setSaving] = useState(false)
  const loadPreferences = useCallback(async () => {
    try {
      const result = await notificationPreferences.list()
      setPreferences((['LIKE', 'COMMENT'] as const).map(tipoEvento => ({ tipoEvento, activo: result.preferencias.find(item => item.tipoEvento === tipoEvento)?.activo ?? true })))
      setPreferenceError('')
    } catch (failure) { setPreferenceError(errorMessage(failure)) }
  }, [])
  useEffect(() => { void loadPreferences() }, [loadPreferences])
  const toggle = async () => {
    if (!userId) return
    setPending(true)
    setError('')
    try {
      if (enabled) await disableNotifications(getToken() ?? '')
      else await enableNotifications(userId, getToken() ?? '')
    } catch (failure) { setError(errorMessage(failure)) }
    finally { setEnabled(notificationsEnabled(userId)); setPending(false) }
  }
  const savePreference = async (tipoEvento: NotificationPreference['tipoEvento'], activo: boolean) => {
    if (!preferences) return
    setSaving(true)
    try {
      await notificationPreferences.save([{ tipoEvento, activo }])
      setPreferences(previous => previous?.map(item => item.tipoEvento === tipoEvento ? { ...item, activo } : item) ?? null)
      setPreferenceError('')
    } catch (failure) { setPreferenceError(errorMessage(failure)) }
    finally { setSaving(false) }
  }
  return <>
    <PageTitle title="Configurar notificaciones" back={{ to: '/notificaciones', label: 'Volver a notificaciones' }} />
    <section aria-label="Dispositivo">
      <h2>En este dispositivo</h2>
      <label className="check-row"><input type="checkbox" checked={enabled} disabled={pending} onChange={() => void toggle()} /><span>Notificaciones de este dispositivo</span></label>
      <p className="field-hint" role="status">{pending ? 'Actualizando…' : enabled ? 'Activadas' : 'Desactivadas'}</p>
      <ErrorMessage message={error} />
    </section>
    <section aria-label="Tipos de notificación" className="notification-preferences">
      <h2>Qué querés recibir</h2>
      <ErrorMessage message={preferenceError} />
      {preferenceError && <Button variant="secondary" onClick={() => void loadPreferences()}>Reintentar preferencias</Button>}
      {!preferences && !preferenceError && <p role="status">Cargando preferencias…</p>}
      {preferences?.map(item => <label className="check-row" key={item.tipoEvento}>
        <input type="checkbox" checked={item.activo} disabled={saving} onChange={event => void savePreference(item.tipoEvento, event.target.checked)} />
        <span>{item.tipoEvento === 'LIKE' ? 'Me gusta en mis obras' : 'Comentarios en mis obras'}</span>
      </label>)}
    </section>
  </>
}
