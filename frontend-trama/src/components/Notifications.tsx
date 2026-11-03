import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDemo } from '../context/DemoContext'
import { getToken } from '../data/api'
import { disableNotifications, enableNotifications, listenNotifications, notificationsEnabled, type PushNotice } from '../data/push'
import { errorMessage } from '../data/store'
import { EmptyState, ErrorMessage, IconButton, Modal } from './UI'

export function Notifications() {
  const { user, notify } = useDemo()
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(() => !!user && notificationsEnabled(user.id))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notices, setNotices] = useState<PushNotice[]>([])
  const seen = useRef(new Set<string>())
  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    return listenNotifications(userId, notice => {
      if (seen.current.has(notice.id)) return
      seen.current.add(notice.id)
      setNotices(previous => [notice, ...previous].slice(0, 20))
      notify(`${notice.title}: ${notice.body}`, 'info')
    })
  }, [userId, notify])

  useEffect(() => {
    if (!userId || !notificationsEnabled(userId)) return
    let active = true
    void enableNotifications(userId, getToken() ?? '').catch(failure => {
      if (active) { setEnabled(false); setError(errorMessage(failure)) }
    })
    return () => { active = false }
  }, [userId])

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

  return <>
    <IconButton icon={Bell} label="Notificaciones" onClick={() => setOpen(true)} />
    {open && <Modal open title="Notificaciones" onClose={() => setOpen(false)}>
      <label className="check-row"><input type="checkbox" checked={enabled} disabled={pending} aria-busy={pending || undefined} onChange={() => void toggle()} /><span>Notificaciones de este dispositivo</span></label>
      <p className="field-hint" role="status">{pending ? 'Actualizando…' : enabled ? 'Activadas' : 'Desactivadas'}</p>
      <ErrorMessage message={error} />
      {notices.length ? <ul className="notification-list">{notices.map(notice => <li key={notice.id}>
        <Link to={notice.path} onClick={() => setOpen(false)}><strong>{notice.title}</strong><p>{notice.body}</p></Link>
      </li>)}</ul> : <EmptyState icon={Bell} title="No hay notificaciones nuevas" description="" />}
    </Modal>}
  </>
}