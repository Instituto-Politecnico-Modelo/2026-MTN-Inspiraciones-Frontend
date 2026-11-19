import { useId } from 'react'
import { MAX_RADIUS_KM, type ProximityAccess, type ProximityReason } from '../data/places'

const reasons: Record<Exclude<ProximityReason, 'ok'>, string> = {
  desactivada: 'La ubicación está desactivada. Podés activarla en la configuración de ubicación.',
  'sin-decision': 'Todavía no elegiste si usar tu ubicación. Podés decidirlo en la configuración de ubicación.',
  'permiso-denegado': 'Falta el permiso del dispositivo para usar tu ubicación. Podés corregirlo desde la configuración del navegador.',
  'sin-soporte': 'Este navegador no permite obtener tu ubicación.',
}

export function DistanceControl({ value, onChange, access }: { value: number; onChange: (km: number) => void; access: ProximityAccess }) {
  const id = useId()
  return <div className="distance-control">
    <label htmlFor={id}>Distancia máxima</label>
    <div className="distance-row">
      <input id={id} type="range" min={1} max={MAX_RADIUS_KM} step={1} value={value} disabled={!access.enabled}
        aria-valuetext={`${value} km`} onChange={event => onChange(Number(event.target.value))} />
      <span className="distance-value">{value} km</span>
    </div>
    {access.reason !== 'ok' && <p className="field-hint" role="status">{reasons[access.reason]}</p>}
  </div>
}
