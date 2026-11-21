import { useEffect, useRef, useState } from 'react'
import { LocateFixed } from 'lucide-react'
import { Link } from 'react-router-dom'
import { FeedMap } from '../components/FeedMap'
import { PostGrid } from '../components/PostCard'
import { Button, ErrorMessage } from '../components/UI'
import { placesApi } from '../data/api'
import type { Post } from '../data/model'
import { cityWorks, nearbyWorks, NEARBY_RADIUS_KM } from '../data/nearbyFeed'
import type { Coordinates, LocationPreference } from '../data/places'
import { getPosition } from '../lib/geolocation'
import { useDevicePermission } from '../lib/useDevicePermission'

const PAGE_SIZE = 12
const settingsPath = '/ubicacion/configuracion?desde=inicio'

function NearbyResults({ title, posts, empty, more }: { title: string; posts: Post[]; empty: string; more: string }) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  return <section className="nearby-section">
    <h2>{title}</h2>
    {posts.length ? <PostGrid posts={posts.slice(0, limit)} compact /> : <p className="muted">{empty}</p>}
    {posts.length > limit && <div><Button variant="secondary" onClick={() => setLimit(current => current + PAGE_SIZE)}>{more}</Button></div>}
  </section>
}

type Results = {
  nearby: PromiseSettledResult<string[]>
  city: PromiseSettledResult<Awaited<ReturnType<typeof cityWorks>>>
}

export function NearbyFeed({ posts }: { posts: Post[] }) {
  const [preference, setPreference] = useState<LocationPreference | undefined>(undefined)
  const [permission, refreshPermission] = useDevicePermission()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<Results>()
  const [center, setCenter] = useState<Coordinates>()
  const request = useRef<AbortController | null>(null)

  useEffect(() => {
    let active = true
    placesApi.preference.get().then(value => { if (active) setPreference(value) },
      () => { if (active) setError('No pudimos leer tu preferencia de ubicación. Podés reintentar.') })
    return () => { active = false; request.current?.abort() }
  }, [])

  const search = async () => {
    request.current?.abort()
    const current = new AbortController()
    request.current = current
    const { signal } = current
    setLoading(true)
    setError('')
    setResults(undefined)
    try {
      if (preference !== 'ACTIVADA') {
        if (await placesApi.preference.set('ACTIVADA') !== 'ACTIVADA') throw new Error('No se activó la preferencia.')
        signal.throwIfAborted()
        setPreference('ACTIVADA')
      }
      const center = await getPosition()
      signal.throwIfAborted()
      setCenter(center)
      const [nearby, city] = await Promise.allSettled([nearbyWorks(center, signal), cityWorks(center, signal)])
      if (!signal.aborted) setResults({ nearby, city })
    } catch {
      if (!signal.aborted) setError('No pudimos usar tu ubicación. Revisá el permiso del navegador y volvé a intentar.')
    } finally {
      if (!signal.aborted) {
        setLoading(false)
        refreshPermission()
      }
    }
  }

  const byId = new Map(posts.map(post => [post.id, post]))
  const blocked = permission === 'denied' || permission === 'unsupported'
  const nearby = results?.nearby.status === 'fulfilled' ? results.nearby.value.flatMap(id => byId.get(id) ?? []) : []
  const shownNearby = new Set(nearby.map(post => post.id))
  const city = results?.city.status === 'fulfilled' ? results.city.value : null
  const cityPosts = city?.ids.flatMap(id => shownNearby.has(id) ? [] : (byId.get(id) ?? [])) ?? []
  const actionLabel = results ? 'Actualizar ubicación'
    : preference === 'ACTIVADA' ? 'Usar mi ubicación' : 'Activar y usar mi ubicación'

  return <div className="nearby-feed">
    <div className="feed-map-heading">
      <div>
        <h2>Mapa de publicaciones</h2>
        <p className="muted">Mové el mapa, ajustá el zoom o tocá un punto para abrir la publicación.</p>
      </div>
      {!blocked && <Button variant="secondary" loading={loading} disabled={preference === undefined && !error} onClick={() => void search()}>
        <LocateFixed size={17} aria-hidden="true" />{actionLabel}
      </Button>}
    </div>
    <FeedMap posts={posts} center={blocked ? undefined : center} />
    {blocked ? <div className="nearby-section">
      <h2>No podemos acceder a tu ubicación</h2>
      <p className="muted">{permission === 'denied'
        ? 'Para ver obras cerca tuyo, habilitá la ubicación en los permisos de este sitio en tu navegador.'
        : 'Para ver obras cerca tuyo, abrí Trama en un navegador compatible con la ubicación del dispositivo.'}</p>
      <div><Link className="button button-secondary" to={settingsPath}>Configuración de ubicación</Link></div>
    </div> : <>
      {!results && preference !== 'ACTIVADA' && <p className="field-hint">Si activás la ubicación, Trama solo guarda tu preferencia.</p>}
      {loading && <p role="status" className="muted">Buscando publicaciones cerca tuyo…</p>}
      <ErrorMessage message={error} />
      {results && <>
        <NearbyResults title={`A menos de ${NEARBY_RADIUS_KM} km`} posts={nearby} more="Ver más publicaciones cercanas"
          empty={results.nearby.status === 'rejected' ? 'No pudimos cargar las publicaciones cercanas.' : 'Todavía no hay publicaciones cerca de tu ubicación.'} />
        {city ? <NearbyResults title={`En ${city.name}`} posts={cityPosts} more={`Ver más en ${city.name}`}
          empty={nearby.length ? 'No encontramos más publicaciones en tu ciudad.' : 'Todavía no hay publicaciones en tu ciudad.'} />
          : <section className="nearby-section">
            <h2>En tu ciudad</h2>
            <p className="muted">{results.city.status === 'rejected' ? 'No pudimos cargar las publicaciones de tu ciudad.'
              : 'Tu ubicación está fuera de las localidades argentinas que podemos identificar.'}</p>
          </section>}
        <div><Link className="button button-ghost" to={settingsPath}>Configuración de ubicación</Link></div>
        {city && <p className="field-hint">Límites de localidad según <a href="https://portalgeoestadistico.indec.gob.ar/">cartografía del INDEC</a>.</p>}
      </>}
    </>}
  </div>
}
