import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiRepository, notificationPreferences, rankedFeed } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

it('consulta y guarda las preferencias web en la API principal, aunque Push esté caído', async () => {
  localStorage.setItem('trama-token', 'test-token')
  const fetch = vi.fn(async (path: string, _options: RequestInit) => {
    if (path.startsWith('/api/push-notifications')) return new Response(null, { status: 502 })
    return new Response(JSON.stringify({ preferencias: [
      { tipoEvento: 'LIKE', activo: true }, { tipoEvento: 'COMMENT', activo: false }, { tipoEvento: 'REPORT', activo: true },
    ] }))
  })
  vi.stubGlobal('fetch', fetch)

  expect(await notificationPreferences.list()).toEqual({ preferencias: [
    { tipoEvento: 'LIKE', activo: true }, { tipoEvento: 'COMMENT', activo: false },
  ] })
  await notificationPreferences.save([{ tipoEvento: 'COMMENT', activo: true }])
  expect(fetch).toHaveBeenNthCalledWith(1, '/api/usuarios/me/notificaciones', expect.objectContaining({ method: 'GET' }))
  expect(fetch).toHaveBeenNthCalledWith(2, '/api/usuarios/me/notificaciones', expect.objectContaining({
    method: 'PUT', body: JSON.stringify({ preferencias: [{ tipoEvento: 'COMMENT', activo: true }] }),
  }))
})

describe('feed con cercanía (FR-021/022)', () => {
  const stub = (preference: string, permission: string) => {
    localStorage.setItem('trama-token', 'test-token')
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: -34.6, longitude: -58.4 } }) },
      permissions: { query: async () => ({ state: permission }) },
    })
    const fetch = vi.fn(async (url: string, _init?: RequestInit) => new Response(JSON.stringify(
      url.includes('preferencia-ubicacion') ? { estado: preference } : { items: [{ id: 'p1' }], nextCursor: null },
    ), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    return fetch
  }

  it('con preferencia activada y permiso usa POST con la posición solo en el cuerpo', async () => {
    const fetch = stub('ACTIVADA', 'granted')
    expect(await rankedFeed()).toEqual(['p1'])
    const call = fetch.mock.calls.find(([url]) => url.includes('/ubicacion')) as unknown as [string, RequestInit]
    expect(call[0]).toBe('/api/feed/recomendaciones/ubicacion')
    expect(call[1]).toMatchObject({ method: 'POST', cache: 'no-store' })
    expect(JSON.parse(call[1].body as string)).toMatchObject({ ubicacionUsuario: { latitud: -34.6, longitud: -58.4 } })
  })

  it('sin consentimiento o sin permiso conserva el GET original', async () => {
    for (const [preference, permission] of [['DESACTIVADA', 'granted'], ['ACTIVADA', 'denied']]) {
      const fetch = stub(preference!, permission!)
      await rankedFeed()
      expect(fetch.mock.calls.some(([url]) => url.includes('/ubicacion'))).toBe(false)
      expect(fetch.mock.calls.some(([url]) => url.startsWith('/api/feed/recomendaciones?'))).toBe(true)
    }
  })
})

describe('búsqueda de perfiles compartidos', () => {
  it('encuentra una cuenta remota sin publicaciones por su usuario', async () => {
    localStorage.setItem('trama-token', 'test-token')
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { id: 'remote-user', username: 'artista.nueva', nombreCompleto: 'Artista Nueva' },
    ]), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const repository = new ApiRepository()

    const users = await repository.searchUsers(' @Artista ')

    expect(fetch).toHaveBeenCalledWith('/api/usuarios/buscar', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      body: JSON.stringify({ busqueda: 'Artista' }),
    }))
    expect(users).toEqual([expect.objectContaining({ id: 'remote-user', handle: 'artista.nueva', name: 'Artista Nueva' })])
  })

  it('pide el directorio compartido cuando la búsqueda está vacía', async () => {
    localStorage.setItem('trama-token', 'test-token')
    const fetch = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetch)

    expect(await new ApiRepository().searchUsers(' @ ')).toEqual([])
    expect(fetch).toHaveBeenCalledWith('/api/usuarios/buscar', expect.objectContaining({ body: JSON.stringify({ busqueda: '' }) }))
  })

  it('carga un perfil por usuario sin sesión ni datos precargados', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'remote-user', username: 'remota', nombreCompleto: 'Artista Remota' }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)

    const user = await new ApiRepository().getProfile({ username: 'Remota' })

    expect(fetch).toHaveBeenCalledWith('/api/usuarios/username/remota', expect.objectContaining({ method: 'GET', headers: {} }))
    expect(user).toMatchObject({ id: 'remote-user', handle: 'remota' })
  })

  it('conserva el perfil encontrado después de actualizar los datos compartidos', async () => {
    localStorage.setItem('trama-token', 'test-token')
    const remote = { id: 'remote-user', username: 'remota', nombreCompleto: 'Artista Remota' }
    vi.stubGlobal('fetch', vi.fn(async (path: string) => {
      const payload = path === '/api/usuarios/buscar' ? [remote]
        : path === '/api/usuarios/me' ? { id: 'me', username: 'actual', role: 'USER' }
        : path === '/api/usuarios/remote-user' ? remote : { items: [] }
      return new Response(JSON.stringify(payload), { status: 200 })
    }))
    const repository = new ApiRepository()
    await repository.searchUsers('remota')

    const state = await repository.load()

    expect(state.users).toContainEqual(expect.objectContaining({ id: 'remote-user', handle: 'remota' }))
  })
})
