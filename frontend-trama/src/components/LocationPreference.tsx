import { useEffect, useRef, useState } from 'react'
import type { DevicePermission, LocationPreference } from '../data/places'
import { errorMessage } from '../data/store'
import { Button, ErrorMessage, Modal } from './UI'

type PreferenceApi = {
  preference: {
    get: () => Promise<LocationPreference>
    set: (state: 'ACTIVADA' | 'DESACTIVADA') => Promise<LocationPreference>
    claimNotice: () => Promise<boolean>
  }
}

// Solo se guarda la decisión; las coordenadas nunca se persisten (FR-011).
export function LocationNotice({ api }: { api: PreferenceApi }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const claimed = useRef(false)
  useEffect(() => {
    // El reclamo es único en el servidor: un segundo intento (StrictMode) perdería el aviso.
    if (claimed.current) return
    claimed.current = true
    api.preference.claimNotice().then(show => { if (show) setOpen(true) }).catch(() => undefined)
  }, [api])
  const choose = async (state: 'ACTIVADA' | 'DESACTIVADA') => {
    setSaving(true)
    setError('')
    try { await api.preference.set(state); setOpen(false) } catch (failure) { setError(errorMessage(failure)) } finally { setSaving(false) }
  }
  if (!open) return null
  return <Modal open title="¿Usar tu ubicación?" busy={saving} onClose={() => setOpen(false)}
    description="Con tu permiso mostramos lugares de inspiración cerca tuyo y damos prioridad a obras de tu entorno.">
    <p className="muted">Tus coordenadas no se guardan: se usan solo en cada consulta. Si cerrás este aviso sin elegir, no usamos tu ubicación y podés decidir después en la configuración de ubicación.</p>
    <ErrorMessage message={error} />
    <div className="dialog-actions">
      <Button variant="secondary" disabled={saving} onClick={() => setOpen(false)}>Cerrar</Button>
      <Button variant="secondary" disabled={saving} onClick={() => void choose('DESACTIVADA')}>No usar mi ubicación</Button>
      <Button loading={saving} onClick={() => void choose('ACTIVADA')}>Activar ubicación</Button>
    </div>
  </Modal>
}

export function LocationSettings({ api, permission, requestPermission }: { api: PreferenceApi; permission: DevicePermission; requestPermission?: () => Promise<void> }) {
  const [preference, setPreference] = useState<LocationPreference | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api.preference.get().then(value => { if (active) setPreference(value) }).catch(failure => { if (active) setError(errorMessage(failure)) })
    return () => { active = false }
  }, [api])
  const enabled = preference === 'ACTIVADA'
  const toggle = async () => {
    setSaving(true)
    setError('')
    try { setPreference(await api.preference.set(enabled ? 'DESACTIVADA' : 'ACTIVADA')) } catch (failure) { setError(errorMessage(failure)) } finally { setSaving(false) }
  }
  if (preference === undefined && !error) return <p role="status">Cargando tu preferencia…</p>
  return <div className="form-stack">
    <label className="check-row">
      <input type="checkbox" checked={enabled} disabled={saving || preference === undefined} onChange={() => void toggle()} />
      <span>Usar mi ubicación para ver lugares cercanos</span>
    </label>
    <p className="field-hint">Solo guardamos esta decisión, nunca tus coordenadas.</p>
    {enabled && permission !== 'granted' && <p role="status" className="field-hint">
      {permission === 'unsupported' ? 'Este navegador no permite obtener tu ubicación.'
        : 'El permiso del dispositivo para la ubicación no está concedido. Tu preferencia sigue activada; podés corregirlo desde la configuración del navegador.'}
    </p>}
    {enabled && permission === 'prompt' && requestPermission && <div><Button variant="secondary" onClick={() => void requestPermission()}>Permitir en este dispositivo</Button></div>}
    <ErrorMessage message={error} />
  </div>
}
