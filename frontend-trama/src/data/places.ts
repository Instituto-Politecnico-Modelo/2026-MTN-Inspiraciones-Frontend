export const MAX_OWN_TAGS = 3
export const MAX_RADIUS_KM = 100
const MAX_TAG_LENGTH = 100

export type Coordinates = { latitud: number; longitud: number }
export type CatalogTechnique = { codigo: string; nombre: string }
export type CatalogDiscipline = { codigo: string; nombre: string; tecnicas: CatalogTechnique[] }
export type LocationPreference = 'PENDIENTE' | 'ACTIVADA' | 'DESACTIVADA' | null
export type DevicePermission = 'granted' | 'denied' | 'prompt' | 'unsupported'
export type ProximityReason = 'ok' | 'desactivada' | 'sin-decision' | 'permiso-denegado' | 'sin-soporte'
export type ProximityAccess = { enabled: boolean; reason: ProximityReason }

// Misma normalización que el servidor: recorte, minúsculas, sin vacíos ni duplicados (FR-016).
export function normalizeOwnTags(input: string[]): { tags: string[]; error: string } {
  const tags: string[] = []
  let error = ''
  for (const raw of input) {
    const tag = raw.trim().toLowerCase()
    if (!tag || tags.includes(tag)) continue
    if (tag.length > MAX_TAG_LENGTH) { error ||= `Cada tag puede tener hasta ${MAX_TAG_LENGTH} caracteres.`; continue }
    if (tags.length === MAX_OWN_TAGS) { error ||= `Podés agregar hasta ${MAX_OWN_TAGS} tags propios.`; continue }
    tags.push(tag)
  }
  return { tags, error }
}

export function validateRadius(km: number): string {
  return Number.isFinite(km) && km > 0 && km <= MAX_RADIUS_KM ? '' : `Elegí una distancia mayor que 0 y de hasta ${MAX_RADIUS_KM} km.`
}

export function validateCoordinates(latitud: number, longitud: number): string {
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return 'Escribí la latitud y la longitud con números.'
  if (latitud < -90 || latitud > 90) return 'La latitud debe estar entre -90 y 90.'
  if (longitud < -180 || longitud > 180) return 'La longitud debe estar entre -180 y 180.'
  return ''
}

// Ambos campos vacíos significan «sin lugar»; completar solo uno es un dato incompleto (FR-003).
export function parsePlace(latitude: string, longitude: string): { value: Coordinates | null; error: string } {
  const lat = latitude.trim()
  const lon = longitude.trim()
  if (!lat && !lon) return { value: null, error: '' }
  if (!lat || !lon) return { value: null, error: 'Completá la latitud y la longitud, o dejá ambas vacías.' }
  const latitud = Number(lat.replace(',', '.'))
  const longitud = Number(lon.replace(',', '.'))
  const error = validateCoordinates(latitud, longitud)
  return error ? { value: null, error } : { value: { latitud, longitud }, error: '' }
}

export function techniquesFor(catalog: CatalogDiscipline[], discipline: string): CatalogTechnique[] {
  return catalog.find(item => item.codigo.toLowerCase() === discipline.toLowerCase())?.tecnicas ?? []
}

export function proximityAccess(preference: LocationPreference, permission: DevicePermission): ProximityAccess {
  if (preference === 'DESACTIVADA') return { enabled: false, reason: 'desactivada' }
  if (preference !== 'ACTIVADA') return { enabled: false, reason: 'sin-decision' }
  if (permission === 'granted') return { enabled: true, reason: 'ok' }
  return { enabled: false, reason: permission === 'unsupported' ? 'sin-soporte' : 'permiso-denegado' }
}

export function mergeById<T extends { id: string }>(shown: T[], incoming: T[]): T[] {
  const seen = new Set(shown.map(item => item.id))
  return [...shown, ...incoming.filter(item => !seen.has(item.id))]
}

export type Zone = { sur: number; norte: number; oeste: number; este: number }

// Normaliza los límites del mapa: oeste mayor que este significa que cruza el antimeridiano.
export function boundsToZone(bounds: { south: number; north: number; west: number; east: number }): Zone {
  const wrap = (longitude: number) => ((longitude + 180) % 360 + 360) % 360 - 180
  const sur = Math.max(-90, bounds.south)
  const norte = Math.min(90, bounds.north)
  if (bounds.east - bounds.west >= 360) return { sur, norte, oeste: -180, este: 180 }
  return { sur, norte, oeste: wrap(bounds.west), este: wrap(bounds.east) }
}

// El contenido guarda título y descripción separados por salto de línea, más metadatos tras una marca.
export function publicationText(content: string): { title: string; description: string } {
  const [first = '', ...rest] = (content.split('\u2063trama:')[0] ?? '').split('\n')
  return { title: first.trim() || 'Sin título', description: rest.join('\n').trim() }
}
