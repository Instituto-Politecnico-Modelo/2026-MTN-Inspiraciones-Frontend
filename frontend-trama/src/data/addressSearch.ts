import { z } from 'zod'
import { validateCoordinates, type Coordinates } from './places'

const GEOREF_URL = 'https://apis.datos.gob.ar/georef/api/v2.0/direcciones'
export const MAX_ADDRESS_LENGTH = 160
export const MAX_LOCALITY_LENGTH = 100

const responseSchema = z.object({ direcciones: z.array(z.unknown()) })
const resultSchema = z.object({
  nomenclatura: z.string().trim().min(1),
  altura: z.object({ valor: z.number().nullable() }).nullish(),
  ubicacion: z.object({ lat: z.number(), lon: z.number() }),
})

export type AddressMatch = { label: string; location: Coordinates; approximate: boolean }

export async function searchAddresses(street: string, locality: string, signal: AbortSignal): Promise<AddressMatch[]> {
  const url = new URL(GEOREF_URL)
  url.searchParams.set('direccion', street.trim())
  url.searchParams.set('max', '5')
  if (locality.trim()) url.searchParams.set('localidad', locality.trim())
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  })
  if (!response.ok) throw new Error(`Georef HTTP ${response.status}`)

  const { direcciones } = responseSchema.parse(await response.json())
  const matches: AddressMatch[] = []
  for (const item of direcciones) {
    const result = resultSchema.safeParse(item)
    if (!result.success) continue
    const { nomenclatura, altura, ubicacion: { lat, lon } } = result.data
    if (validateCoordinates(lat, lon)) continue
    if (matches.some(({ location }) => location.latitud === lat && location.longitud === lon)) continue
    matches.push({ label: nomenclatura, location: { latitud: lat, longitud: lon }, approximate: !altura?.valor })
  }
  return matches
}
