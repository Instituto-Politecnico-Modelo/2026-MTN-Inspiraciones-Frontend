import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiRepository } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
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

  it('no envía búsquedas vacías al servidor', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    expect(await new ApiRepository().searchUsers(' @ ')).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
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