import { useEffect, useState } from 'react'
import type { DevicePermission, LocationPreference } from '../data/places'
import { errorMessage } from '../data/store'
import { Button, ErrorMessage } from './UI'

type PreferenceApi = {
  preference: {
    get: () => Promise<LocationPreference>
    set: (state: 'ACTIVADA' | 'DESACTIVADA') => Promise<LocationPreference>
  }
}

// Solo se guarda la decisión, desde Editar perfil o Configuración de ubicación; las coordenadas nunca se persisten (FR-011).
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
