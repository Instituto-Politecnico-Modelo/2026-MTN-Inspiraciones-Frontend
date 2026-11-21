import { placesApi, type MapPage, type MapPublication, type MapQuery } from './api'
import { resolveLocality } from './localities'
import type { Coordinates, Zone } from './places'

export const NEARBY_RADIUS_KM = 5

async function matchingWorks(criterio: MapQuery['criterio'], include: (post: MapPublication) => boolean, signal: AbortSignal) {
  const works = new Map<string, MapPage['items'][number]>()
  const cursors = new Set<string>()
  let cursor: string | null = null
  do {
    signal.throwIfAborted()
    const page = await placesApi.query({ criterio, cursor, limite: 100 }, signal)
    for (const entry of page.items) {
      if (include(entry.publicacion)) works.set(entry.publicacion.id, entry)
    }
    cursor = page.nextCursor
    if (cursor && cursors.has(cursor)) throw new Error('No pudimos cargar todas las publicaciones.')
    if (cursor) cursors.add(cursor)
  } while (cursor)
  return works
}

export async function nearbyWorks(center: Coordinates, signal: AbortSignal) {
  const works = await matchingWorks({ modo: 'RADIO', centro: center, radioKm: NEARBY_RADIUS_KM }, () => true, signal)
  return [...works.keys()]
}

export async function mapWorks(zone: Zone, signal: AbortSignal) {
  const works = await matchingWorks({ modo: 'ZONA', ...zone }, () => true, signal)
  return [...works.values()]
}

export async function cityWorks(center: Coordinates, signal: AbortSignal) {
  const city = await resolveLocality(center, signal)
  if (!city) return null
  const works = await matchingWorks({ modo: 'ZONA', ...city.zone }, post => !!post.ubicacion && city.contains(post.ubicacion), signal)
  return { name: city.name, ids: [...works.keys()] }
}
