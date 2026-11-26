import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiRepository, excelReports, notificationInbox, notificationPreferences, rankedFeed } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

it('envía la clave de intención sin cambiar el contrato público de reportes', async () => {
  localStorage.setItem('trama-token', 'test-token')
  const report = { id: 'report/1', tipoReporte: 'DESAFIOS', estado: 'EN_PROCESO', fechaInicioGeneracion: '2026-11-26T18:00:00Z' }
  const fetch = vi.fn(async () => new Response(JSON.stringify(report), { status: 202 }))
  vi.stubGlobal('fetch', fetch)

  await excelReports.request('DESAFIOS', '2026-11-01', '2026-11-26', 'key-for-this-intention')
  expect(fetch).toHaveBeenLastCalledWith('/api/admin/reportes/excel', expect.objectContaining({
    method: 'POST',
    headers: expect.objectContaining({ Authorization: 'Bearer test-token', 'Idempotency-Key': 'key-for-this-intention' }),
    body: JSON.stringify({ tipoReporte: 'DESAFIOS', rangoDeFechas: { fechaInicio: '2026-11-01', fechaFin: '2026-11-26' } }),
  }))
  await expect(excelReports.status(report.id)).resolves.toEqual(report)
  expect(fetch).toHaveBeenLastCalledWith('/api/admin/reportes/excel/report%2F1', expect.objectContaining({ cache: 'no-store' }))
  await notificationInbox.list()
  expect(fetch).toHaveBeenLastCalledWith('/api/usuarios/me/notificaciones/bandeja', expect.objectContaining({ cache: 'no-store' }))
})

it('ingresa con Google y guarda la sesión igual que el ingreso con correo', async () => {
  const fetch = vi.fn(async (_path: string, _options: RequestInit) => new Response(JSON.stringify({ accessToken: 'token-google', user: { id: 'usuario-google' } })))
  vi.stubGlobal('fetch', fetch)

  expect(await new ApiRepository().loginWithGoogle('id-token-de-prueba')).toBe('usuario-google')
  expect(localStorage.getItem('trama-token')).toBe('token-google')
  expect(fetch).toHaveBeenCalledWith('/api/auth/google', expect.objectContaining({ method: 'POST', body: JSON.stringify({ idToken: 'id-token-de-prueba' }) }))
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
