import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { assetUrl, type MapPage, type MapQuery } from '../data/api'
import { mergeById, publicationText, type Coordinates, type ProximityAccess, type Zone } from '../data/places'
import { errorMessage } from '../data/store'
import { DistanceControl } from './DistanceControl'
import { MapView } from './MapView'
import { Button, ErrorMessage } from './UI'

const WORLD: Zone = { sur: -90, norte: 90, oeste: -180, este: 180 }
const PAGE = 20
type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Entry = MapPage['items'][number] & { id: string }
type Props = {
  api: { query: (body: MapQuery) => Promise<MapPage>; detail: (id: string) => Promise<Json> }
  access: ProximityAccess
  getPosition: () => Promise<Coordinates>
}

const toEntry = (item: MapPage['items'][number]): Entry => ({ ...item, id: String(item.publicacion.id) })

export function PlacesExplorer({ api, access, getPosition }: Props) {
  const [zone, setZone] = useState<Zone>(WORLD)
  const [radius, setRadius] = useState(25)
  const [nearby, setNearby] = useState(false)
  const [items, setItems] = useState<Entry[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mapDown, setMapDown] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<Json | null>(null)
  const [detailError, setDetailError] = useState('')
  const request = useRef(0)
  const lastCriterion = useRef<MapQuery['criterio']>({ modo: 'ZONA', ...WORLD })
  const lastView = useRef<Zone>(WORLD)
  const radial = nearby && access.enabled

  useEffect(() => {
    const current = ++request.current
    const timeout = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const criterio: MapQuery['criterio'] = radial ? { modo: 'RADIO', centro: await getPosition(), radioKm: radius } : { modo: 'ZONA', ...zone }
        const page = await api.query({ criterio, limite: PAGE })
        if (current !== request.current) return
        lastCriterion.current = criterio
        setItems(page.items.map(toEntry))
        setCursor(page.nextCursor)
      } catch (failure) {
        if (current !== request.current) return
        setError(errorMessage(failure))
        if (radial) setNearby(false)
      } finally {
        if (current === request.current) setLoading(false)
      }
    }, radial ? 300 : 0)
    return () => clearTimeout(timeout)
  }, [api, getPosition, radial, radius, zone])

  const more = async () => {
    if (!cursor) return
    try {
      const page = await api.query({ criterio: lastCriterion.current, cursor, limite: PAGE })
      setItems(previous => mergeById(previous, page.items.map(toEntry)))
      setCursor(page.nextCursor)
    } catch (failure) { setError(errorMessage(failure)) }
  }

  const select = async (id: string) => {
    setSelected(id)
    setDetail(null)
    setDetailError('')
    try { setDetail(await api.detail(id)) } catch (failure) { setDetailError(errorMessage(failure)) }
  }

  const changeView = (view: Zone) => {
    lastView.current = view
    if (!radial) setZone(view)
  }
  const clearNearby = () => { setNearby(false); setZone(lastView.current) }
  const text = detail ? publicationText(String(detail.contenido ?? '')) : null

  return <div className="map-explorer">
    <div className="map-controls">
      <DistanceControl value={radius} access={access} onChange={km => { setRadius(km); setNearby(true) }} />
      {radial && <Button variant="ghost" onClick={clearNearby}>Quitar filtro de distancia</Button>}
    </div>
    <div className="map-layout">
      <section aria-label="Lugares" className="map-list">
        <ErrorMessage message={error} />
        {loading && !items.length ? <p role="status" className="filter-summary">Buscando lugares…</p>
          : !error && !items.length ? <p className="filter-summary">No hay lugares de inspiración para mostrar.</p>
            : <ul aria-label="Publicaciones con lugar" className="map-entries">{items.map(item => {
              const title = publicationText(String(item.publicacion.contenido ?? '')).title
              return <li key={item.id}>
                <button type="button" aria-pressed={selected === item.id} className={`map-entry ${selected === item.id ? 'is-selected' : ''}`} onClick={() => void select(item.id)}>
                  {item.publicacion.fotoUrl && <img src={assetUrl(item.publicacion.fotoUrl)} alt="" width="64" height="64" />}
                  <span><strong>{title}</strong>{item.distanciaKm !== undefined && <small> · {item.distanciaKm.toFixed(1).replace('.', ',')} km</small>}</span>
                </button>
              </li>
            })}</ul>}
        {cursor && <Button variant="secondary" onClick={() => void more()}>Ver más lugares</Button>}
      </section>
      <div className="map-column">
        <MapView items={items} selectedId={selected} onSelect={id => void select(id)} onViewChange={changeView} onUnavailable={() => setMapDown(true)} />
        {mapDown && <p role="status" aria-label="Estado del mapa" className="map-status">El mapa no está disponible por ahora. La lista sigue disponible.</p>}
        {selected && <div className="place-description" aria-live="polite">
          <ErrorMessage message={detailError} />
          {text ? <><h3>{text.title}</h3>{text.description && <p>{text.description}</p>}
            {detail?.ubicacion && <p className="meta">Lugar publicado: {detail.ubicacion.latitud}, {detail.ubicacion.longitud}</p>}
            <Link className="button button-secondary" to={`/obra/${selected}`}>Ver publicación</Link></>
            : !detailError && <p role="status">Cargando el detalle…</p>}
        </div>}
      </div>
    </div>
  </div>
}
