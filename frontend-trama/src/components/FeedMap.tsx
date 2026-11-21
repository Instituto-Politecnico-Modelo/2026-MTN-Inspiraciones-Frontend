import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Post } from '../data/model'
import { mapWorks, NEARBY_RADIUS_KM } from '../data/nearbyFeed'
import type { Coordinates, Zone } from '../data/places'
import { MapView } from './MapView'
import { Button } from './UI'

const ARGENTINA = { center: { latitud: -37, longitud: -63.5 }, zoom: 4 }
type Items = Awaited<ReturnType<typeof mapWorks>>
type Result = { zone: Zone; attempt: number; items: Items | null }

export function FeedMap({ center, posts }: { center?: Coordinates; posts?: Post[] }) {
  const [zone, setZone] = useState<Zone>()
  const [result, setResult] = useState<Result>()
  const [attempt, setAttempt] = useState(0)
  const [mapDown, setMapDown] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const signedIn = !!posts

  useEffect(() => {
    if (!zone || !signedIn) return
    const controller = new AbortController()
    const { signal } = controller
    const timer = window.setTimeout(() => {
      void mapWorks(zone, signal).then(
        items => { if (!signal.aborted) setResult({ zone, attempt, items }) },
        () => { if (!signal.aborted) setResult({ zone, attempt, items: null }) },
      )
    }, 160)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [attempt, signedIn, zone])

  const current = result?.zone === zone && result?.attempt === attempt ? result : undefined
  const pins = useMemo(() => {
    const known = new Set(posts?.map(post => post.id))
    return current?.items?.filter(item => known.has(item.publicacion.id)) ?? []
  }, [current?.items, posts])
  const focus = useMemo(() => center ? { center, radiusKm: NEARBY_RADIUS_KM } : null, [center])
  const status = !signedIn || (mapDown && !zone) ? '' : !current ? 'Cargando publicaciones de esta zona…' : !current.items ? 'No pudimos cargar las publicaciones de esta zona.'
    : pins.length === 0 ? 'No hay publicaciones con ubicación en esta zona.' : `${pins.length} ${pins.length === 1 ? 'publicación' : 'publicaciones'} en esta zona.`
  return <div className="feed-map">
    <MapView items={pins} selectedId={null} focus={focus} browse={ARGENTINA}
      onSelect={id => navigate(`/obra/${id}`, { state: { from: location.pathname + location.search } })}
      onViewChange={view => setZone(previous => previous && previous.sur === view.sur && previous.norte === view.norte
        && previous.oeste === view.oeste && previous.este === view.este ? previous : view)}
      onUnavailable={() => setMapDown(true)} />
    {mapDown && <p role="status" className="map-status">No se pudo cargar parte del mapa.</p>}
    {status && <div className="feed-map-status">
      <p className="muted" role="status">{status}</p>
      {current?.items === null && <Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>Reintentar</Button>}
    </div>}
  </div>
}
