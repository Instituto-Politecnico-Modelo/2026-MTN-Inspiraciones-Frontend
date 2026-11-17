import { afterEach, describe, expect, it, vi } from 'vitest'
import { placesApi } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

const reply = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status })

describe('cliente del mapa (FR-005-014)', () => {
  it('envía las coordenadas de consulta solo en el cuerpo y nunca en la URL', async () => {
    localStorage.setItem('trama-token', 'test-token')
    const fetch = vi.fn().mockResolvedValue(reply({ items: [], nextCursor: null }))
    vi.stubGlobal('fetch', fetch)
    const body = { criterio: { modo: 'RADIO', centro: { latitud: -34.6, longitud: -58.4 }, radioKm: 25 }, limite: 20 } as const

    await placesApi.query(body)

    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('/api/mapa/publicaciones/consulta')
    expect(url).not.toMatch(/34\.6|58\.4/)
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify(body) })
  })

  it('consulta por zona visible sin coordenadas del usuario', async () => {
    const fetch = vi.fn().mockResolvedValue(reply({ items: [{ publicacion: { id: 'p1' } }], nextCursor: 'siguiente' }))
    vi.stubGlobal('fetch', fetch)

    const page = await placesApi.query({ criterio: { modo: 'ZONA', sur: -35, norte: -34, oeste: -59, este: -58 } })

    expect(page.items).toHaveLength(1)
    expect(page.nextCursor).toBe('siguiente')
  })

  it('lee el detalle visible de una publicación del mapa', async () => {
    const fetch = vi.fn().mockResolvedValue(reply({ id: 'p1' }))
    vi.stubGlobal('fetch', fetch)

    await placesApi.detail('p1')

    expect(fetch).toHaveBeenCalledWith('/api/mapa/publicaciones/p1', expect.objectContaining({ method: 'GET' }))
  })

  it('lee el catálogo único de disciplinas y técnicas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ items: [{ codigo: 'PINTURA', nombre: 'Pintura', tecnicas: [] }] })))

    expect(await placesApi.catalog()).toEqual([{ codigo: 'PINTURA', nombre: 'Pintura', tecnicas: [] }])
  })

  it('consulta, cambia y reclama el aviso de la preferencia de ubicación sin coordenadas', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(reply({ estado: 'PENDIENTE' }))
      .mockResolvedValueOnce(reply({ estado: 'ACTIVADA' }))
      .mockResolvedValueOnce(reply({ mostrar: true }))
    vi.stubGlobal('fetch', fetch)

    expect(await placesApi.preference.get()).toBe('PENDIENTE')
    expect(await placesApi.preference.set('ACTIVADA')).toBe('ACTIVADA')
    expect(await placesApi.preference.claimNotice()).toBe(true)

    expect(fetch.mock.calls.map(call => [call[0], call[1].method])).toEqual([
      ['/api/usuarios/me/preferencia-ubicacion', 'GET'],
      ['/api/usuarios/me/preferencia-ubicacion', 'PUT'],
      ['/api/usuarios/me/preferencia-ubicacion/aviso-inicial', 'POST'],
    ])
    expect(fetch.mock.calls[1]![1].body).toBe(JSON.stringify({ estado: 'ACTIVADA' }))
  })
})
