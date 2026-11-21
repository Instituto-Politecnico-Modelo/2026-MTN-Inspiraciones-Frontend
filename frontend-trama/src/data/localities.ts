import type { Coordinates, Zone } from './places'
import localityDataUrl from './localities-ar.json?url'

type Ring = number[]
type Locality = [name: string, west: number, south: number, east: number, north: number, polygons: Ring[][]]

function inRing(ring: Ring, x: number, y: number) {
  let inside = false
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const ax = ring[j], ay = ring[j + 1], bx = ring[i], by = ring[i + 1]
    if (x >= Math.min(ax, bx) && x <= Math.max(ax, bx) && y >= Math.min(ay, by) && y <= Math.max(ay, by)
      && Math.abs((x - ax) * (by - ay) - (y - ay) * (bx - ax)) < 1e-12) return true
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside
  }
  return inside
}

function contains([, west, south, east, north, polygons]: Locality, { latitud: y, longitud: x }: Coordinates) {
  return x >= west && x <= east && y >= south && y <= north
    && polygons.some(([outer, ...holes]) => inRing(outer, x, y) && !holes.some(hole => inRing(hole, x, y)))
}

export function findLocality(localities: Locality[], center: Coordinates) {
  const locality = localities.find(candidate => contains(candidate, center))
  if (!locality) return null
  const [name, oeste, sur, este, norte] = locality
  return { name, zone: { oeste, sur, este, norte } satisfies Zone, contains: (point: Coordinates) => contains(locality, point) }
}

let catalog: Locality[] | undefined
export async function resolveLocality(center: Coordinates, signal: AbortSignal) {
  if (!catalog) {
    // La cartografía es un archivo de Trama. Las coordenadas no forman parte de la solicitud.
    const response = await fetch(localityDataUrl, { signal })
    if (!response.ok) throw new Error('No pudimos cargar los límites de las localidades.')
    catalog = await response.json() as Locality[]
  }
  return findLocality(catalog, center)
}
