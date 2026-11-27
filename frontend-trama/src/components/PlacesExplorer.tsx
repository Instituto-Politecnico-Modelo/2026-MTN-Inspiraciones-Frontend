import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { MapPage, MapPublication, MapQuery } from '../data/api'
import { mergeById, type Coordinates, type ProximityAccess, type Zone } from '../data/places'
import { errorMessage } from '../data/store'
import { DistanceControl } from './DistanceControl'
import { MapView } from './MapView'
import { ErrorMessage, SelectField } from './UI'

const WORLD: Zone = { sur: -90, norte: 90, oeste: -180, este: 180 }
const PAGE = 100
type Entry = MapPage['items'][number] & { id: string }
const toEntry = (item: MapPage['items'][number]): Entry => ({ ...item, id: String(item.publicacion.id) })
type Props = {
  api: { query: (body: MapQuery) => Promise<MapPage>; detail: (id: string) => Promise<MapPublication> }
  access: ProximityAccess
  getPosition: () => Promise<Coordinates>
  filter?: (publication: MapPublication) => boolean
}

export function PlacesExplorer({ api, access, getPosition, filter }: Props) {
  const [zone, setZone] = useState<Zone>(WORLD)
  const [radius, setRadius] = useState(25)
  const [items, setItems] = useState<Entry[]>([])
  const [criterio, setCriterio] = useState<MapQuery['criterio'] | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<MapPublication | null>(null)
  const [ambiente, setAmbiente] = useState<'' | 'INTERIOR' | 'EXTERIOR'>('')
  const [focus, setFocus] = useState<{ center: Coordinates; radiusKm: number } | null>(null)
  const [error, setError] = useState('')
  const [mapDown, setMapDown] = useState(false)
  const request = useRef(0)
  const picked = useRef<string | null>(null)
  const radial = access.enabled

  useEffect(() => {
    const current = ++request.current
    const timeout = setTimeout(async () => {
      setError('')
      try {
        const next: MapQuery['criterio'] = radial ? { modo: 'RADIO', centro: await getPosition(), radioKm: radius } : { modo: 'ZONA', ...zone }
        const result = await api.query({ criterio: next, limite: PAGE })
        if (current !== request.current) return
        setItems(mergeById([], result.items.map(toEntry)))
        setCursor(result.nextCursor)
        setCriterio(next)
        setFocus(next.modo === 'RADIO' && next.centro ? { center: next.centro, radiusKm: radius } : null)
      } catch (failure) {
        if (current === request.current) setError(errorMessage(failure))
      }
    }, radial ? 300 : 0)
    return () => clearTimeout(timeout)
  }, [api, getPosition, radial, radius, zone])

  const loadMore = async () => {
    if (!cursor || !criterio) return
    const current = request.current
    setLoadingMore(true)
    setError('')
    try {
      const result = await api.query({ criterio, cursor, limite: PAGE })
      if (current !== request.current) return
      setItems(shown => mergeById(shown, result.items.map(toEntry)))
      setCursor(result.nextCursor)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setLoadingMore(false)
    }
  }

  const select = (id: string) => {
    picked.current = id
    setSelectedId(id)
    setDetail(null)
    api.detail(id)
      .then(found => { if (picked.current === id) setDetail(found) })
      .catch(failure => { if (picked.current === id) setError(errorMessage(failure)) })
  }

  const visible = items
    .filter(item => !filter || filter(item.publicacion))
    .filter(item => !ambiente || item.publicacion.ambiente === ambiente)
  return <div className="map-explorer">
    <div className="map-controls">
      <DistanceControl value={radius} access={access} onChange={setRadius} />
      <SelectField label="Dónde se realiza" value={ambiente} onChange={event => setAmbiente(event.target.value as '' | 'INTERIOR' | 'EXTERIOR')}
        options={[{ value: '', label: 'Todas las actividades' }, { value: 'INTERIOR', label: 'Dentro de casa' }, { value: 'EXTERIOR', label: 'Fuera de casa' }]} />
      <Link className="button button-secondary" to="/ubicacion/configuracion">Configuración de ubicación</Link>
    </div>
    <ErrorMessage message={error} />
    <div className="map-layout">
      <div className="map-column">
        <MapView items={visible} selectedId={selectedId} focus={focus} onSelect={select} onViewChange={view => { if (!radial) setZone(view) }} onUnavailable={() => setMapDown(true)} />
        {mapDown && <p role="status" aria-label="Estado del mapa" className="map-status">El mapa no está disponible por ahora.</p>}
      </div>
      <section className="map-places" aria-labelledby="lugares-titulo">
        <h2 id="lugares-titulo">Lugares</h2>
        {visible.length === 0 ? <p className="field-hint">No hay lugares de inspiración para mostrar.</p> : <ul aria-label="Publicaciones con lugar">
          {visible.map(item => <li key={item.id}>
            <button type="button" aria-pressed={selectedId === item.id} onClick={() => select(item.id)}>
              <span>{placeLabel(item.publicacion.contenido)}</span>
              {item.distanciaKm !== undefined && <small>{formatKm(item.distanciaKm)}</small>}
            </button>
          </li>)}
        </ul>}
        {cursor && <button type="button" className="button button-secondary" disabled={loadingMore} onClick={() => void loadMore()}>Ver más lugares</button>}
        {selectedId && <article className="map-detail" aria-live="polite">
          {detail ? <><p>{detail.contenido}</p>{ambienteLabel(detail.ambiente) && <p>{ambienteLabel(detail.ambiente)}</p>}<Link to={`/obra/${detail.id}`}>Abrir obra</Link></> : <p>Cargando lugar…</p>}
        </article>}
      </section>
    </div>
  </div>
}

function placeLabel(text?: string) {
  const clean = (text ?? '').trim()
  if (!clean) return 'Publicación sin texto'
  return clean.length > 60 ? `${clean.slice(0, 60)}…` : clean
}

const formatKm = (km: number) => `${km.toFixed(1).replace('.', ',')} km`

const ambienteLabel = (value: unknown) => value === 'INTERIOR' ? 'Dentro de casa' : value === 'EXTERIOR' ? 'Fuera de casa' : ''

