import { afterEach, describe, expect, it, vi } from 'vitest'
import { placesApi } from './api'
import dataset from './localities-ar.json?raw'
import { findLocality } from './localities'
import { cityWorks, nearbyWorks } from './nearbyFeed'

const capital = { latitud: -34.6037, longitud: -58.3816 }
const villaDevoto = { latitud: -34.6041, longitud: -58.5145 }
const vicenteLopez = { latitud: -34.5292, longitud: -58.4753 }
const argentina = JSON.parse(dataset) as Parameters<typeof findLocality>[0]

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('localidades de Argentina', () => {
  it('agrupa todas las comunas porteñas y excluye localidades del conurbano', () => {
    const city = findLocality(argentina, capital)!
    expect(city.name).toBe('Ciudad Autónoma de Buenos Aires')
    expect(city.contains(villaDevoto)).toBe(true)
    expect(city.contains(vicenteLopez)).toBe(false)
    expect(vicenteLopez.longitud).toBeGreaterThan(city.zone.oeste)
    expect(vicenteLopez.latitud).toBeLessThan(city.zone.norte)
  })

  it('reconoce Rosario y Córdoba, y deja sin localidad un punto en el océano', () => {
    expect(findLocality(argentina, { latitud: -32.9478, longitud: -60.6301 })?.name).toBe('Rosario')
    expect(findLocality(argentina, { latitud: -31.4167, longitud: -64.1833 })?.name).toBe('Córdoba')
    expect(findLocality(argentina, { latitud: -39, longitud: -53 })).toBeNull()
  })
})

describe('consultas de Cerca de mí', () => {
  it('recorre todas las páginas del radio respetando el orden por distancia', async () => {
    const row = (id: string) => ({ publicacion: { id } })
    const query = vi.spyOn(placesApi, 'query')
      .mockResolvedValueOnce({ items: [row('primera'), row('segunda')], nextCursor: 'page-2' })
      .mockResolvedValueOnce({ items: [row('segunda'), row('tercera')], nextCursor: null })
    const signal = new AbortController().signal

    expect(await nearbyWorks(capital, signal)).toEqual(['primera', 'segunda', 'tercera'])
    expect(query).toHaveBeenNthCalledWith(1, { criterio: { modo: 'RADIO', centro: capital, radioKm: 5 }, cursor: null, limite: 100 }, signal)
    expect(query).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: 'page-2' }), signal)
  })

  it('filtra el polígono en todas las páginas de la zona sin enviar el centro en la URL', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(dataset)))
    const row = (id: string, ubicacion: typeof capital) => ({ publicacion: { id, ubicacion } })
    const query = vi.spyOn(placesApi, 'query')
      .mockResolvedValueOnce({ items: [row('vecina', vicenteLopez)], nextCursor: 'page-2' })
      .mockResolvedValueOnce({ items: [row('comuna-distante', villaDevoto), row('centro', capital)], nextCursor: null })
    const signal = new AbortController().signal

    expect(await cityWorks(capital, signal)).toEqual({ name: 'Ciudad Autónoma de Buenos Aires', ids: ['comuna-distante', 'centro'] })
    expect(query).toHaveBeenNthCalledWith(1, expect.objectContaining({ criterio: expect.objectContaining({ modo: 'ZONA' }) }), signal)
    expect(query).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: 'page-2' }), signal)
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('localities-ar.json'), { signal })
  })
})
