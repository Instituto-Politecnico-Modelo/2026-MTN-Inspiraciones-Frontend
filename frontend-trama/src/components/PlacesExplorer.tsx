import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { MapPage, MapQuery } from '../data/api'
import { mergeById, type Coordinates, type ProximityAccess, type Zone } from '../data/places'
import { errorMessage } from '../data/store'
import { DistanceControl } from './DistanceControl'
import { MapView } from './MapView'
import { ErrorMessage } from './UI'

const WORLD: Zone = { sur: -90, norte: 90, oeste: -180, este: 180 }
const PAGE = 100
const MAX_PAGES = 5
type Entry = MapPage['items'][number] & { id: string }
const toEntry = (item: MapPage['items'][number]): Entry => ({ ...item, id: String(item.publicacion.id) })
type Props = {
  api: { query: (body: MapQuery) => Promise<MapPage> }
  access: ProximityAccess
  getPosition: () => Promise<Coordinates>
}

export function PlacesExplorer({ api, access, getPosition }: Props) {
  const navigate = useNavigate()
  const [zone, setZone] = useState<Zone>(WORLD)
  const [radius, setRadius] = useState(25)
  const [items, setItems] = useState<Entry[]>([])
  const [focus, setFocus] = useState<{ center: Coordinates; radiusKm: number } | null>(null)
  const [error, setError] = useState('')
  const [mapDown, setMapDown] = useState(false)
  const request = useRef(0)
  const radial = access.enabled

  useEffect(() => {
    const current = ++request.current
    const timeout = setTimeout(async () => {
      setError('')
      try {
        const criterio: MapQuery['criterio'] = radial ? { modo: 'RADIO', centro: await getPosition(), radioKm: radius } : { modo: 'ZONA', ...zone }
        let all: Entry[] = []
        let cursor: string | null = null
        for (let page = 0; page < MAX_PAGES; page++) {
          const result: MapPage = await api.query({ criterio, ...(cursor ? { cursor } : {}), limite: PAGE })
          all = mergeById(all, result.items.map(toEntry))
          cursor = result.nextCursor
          if (!cursor) break
        }
        if (current !== request.current) return
        setItems(all)
        setFocus(criterio.modo === 'RADIO' && criterio.centro ? { center: criterio.centro, radiusKm: radius } : null)
      } catch (failure) {
        if (current === request.current) setError(errorMessage(failure))
      }
    }, radial ? 300 : 0)
    return () => clearTimeout(timeout)
  }, [api, getPosition, radial, radius, zone])

  return <div className="map-explorer">
    <div className="map-controls">
      <DistanceControl value={radius} access={access} onChange={setRadius} />
      <Link className="button button-secondary" to="/ubicacion/configuracion">Configuración de ubicación</Link>
    </div>
    <ErrorMessage message={error} />
    <div className="map-column">
      <MapView items={items} selectedId={null} focus={focus} onSelect={id => navigate(`/obra/${id}`)} onViewChange={view => { if (!radial) setZone(view) }} onUnavailable={() => setMapDown(true)} />
      {mapDown && <p role="status" aria-label="Estado del mapa" className="map-status">El mapa no está disponible por ahora.</p>}
    </div>
  </div>
}
