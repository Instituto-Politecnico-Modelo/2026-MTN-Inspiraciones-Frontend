import { placesApi, type MapPublication, type MapQuery } from './api'
import { resolveLocality } from './localities'
import type { Coordinates } from './places'

export const NEARBY_RADIUS_KM = 5

async function matchingIds(criterio: MapQuery['criterio'], include: (post: MapPublication) => boolean, signal: AbortSignal) {
  const ids = new Set<string>()
  const cursors = new Set<string>()
  let cursor: string | null = null
  do {
    signal.throwIfAborted()
    const page = await placesApi.query({ criterio, cursor, limite: 100 }, signal)
    for (const { publicacion } of page.items) {
      if (include(publicacion)) ids.add(publicacion.id)
    }
    cursor = page.nextCursor
    if (cursor && cursors.has(cursor)) throw new Error('No pudimos cargar todas las publicaciones.')
    if (cursor) cursors.add(cursor)
  } while (cursor)
  return [...ids]
}

export function nearbyWorks(center: Coordinates, signal: AbortSignal) {
  return matchingIds({ modo: 'RADIO', centro: center, radioKm: NEARBY_RADIUS_KM }, () => true, signal)
}

export async function cityWorks(center: Coordinates, signal: AbortSignal) {
  const city = await resolveLocality(center, signal)
  if (!city) return null
  const ids = await matchingIds({ modo: 'ZONA', ...city.zone }, post => !!post.ubicacion && city.contains(post.ubicacion), signal)
  return { name: city.name, ids }
}
