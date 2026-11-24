// Integración del mapa contra el servicio real. Se ejecuta con: TRAMA_LIVE=1 npx vitest run src/data/places.live.test.ts
import { describe, expect, it } from 'vitest'

const live = !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.TRAMA_LIVE
const IMAGE = '/api/imagenes/b25e8763-ef29-4d6f-b733-f053252ecb00.png'
const WORLD = { modo: 'ZONA', sur: -90, norte: 90, oeste: -180, este: 180 } as const

describe.skipIf(!live)('mapa de lugares contra el servicio real (FR-005-014)', () => {
  it('publica con lugar, consulta por zona y radio, y retira la publicación al quitar el lugar', async () => {
    const { ApiRepository, ApiError, placesApi } = await import('./api')
    const fetchOriginal = globalThis.fetch
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => fetchOriginal(typeof input === 'string' && input.startsWith('/') ? `http://localhost:8080${input}` : input, init)) as typeof fetch
    const repo = new ApiRepository()
    const suffix = Date.now().toString(36)
    const userId = await repo.register({ email: `mapa.${suffix}@gmail.com`, username: `mapa${suffix}`.slice(0, 24), nombreCompleto: 'Prueba Mapa', password: 'ClaveSegura123!' })

    const catalog = await placesApi.catalog()
    expect(catalog.find(item => item.codigo.toLowerCase() === 'pintura')?.tecnicas.map(item => item.codigo.toLowerCase())).toContain('acuarela')

    await repo.execute(userId, {
      type: 'create-post',
      post: { id: 'obra-mapa', title: 'Faro de prueba', description: 'Desde el cabo', alt: 'Un pixel', discipline: 'Pintura', technique: 'acuarela', kind: 'image', src: IMAGE, cover: '', width: 1, height: 1, duration: 0, license: 'CC0', credit: '', creditUrl: '', challengeId: null, location: { latitud: -34.6037, longitud: -58.3816 }, ownTags: ['faro', 'mar'] },
    })
    const postId = repo.resolveId('obra-mapa')

    const zone = await placesApi.query({ criterio: WORLD, limite: 20 })
    expect(zone.items.map(item => item.publicacion.id)).toContain(postId)
    const listed = zone.items.find(item => item.publicacion.id === postId)?.publicacion
    expect(listed).toMatchObject({ ubicacion: { latitud: -34.6037, longitud: -58.3816 } })
    expect([...(listed?.tagsPropios as string[])].sort()).toEqual(['faro', 'mar'])

    // El radio exige la preferencia activada.
    await expect(placesApi.query({ criterio: { modo: 'RADIO', centro: { latitud: -34.6, longitud: -58.4 }, radioKm: 5 } })).rejects.toMatchObject({ status: 403 })
    expect(await placesApi.preference.set('ACTIVADA')).toBe('ACTIVADA')
    const radial = await placesApi.query({ criterio: { modo: 'RADIO', centro: { latitud: -34.6, longitud: -58.4 }, radioKm: 5 } })
    expect(radial.items.find(item => item.publicacion.id === postId)?.distanciaKm).toBeLessThan(5)
    const far = await placesApi.query({ criterio: { modo: 'RADIO', centro: { latitud: 40, longitud: 0 }, radioKm: 5 } })
    expect(far.items.some(item => item.publicacion.id === postId)).toBe(false)

    expect((await placesApi.detail(postId)).id).toBe(postId)

    await repo.load()
    await repo.execute(userId, { type: 'update-post', postId, changes: { title: 'Faro de prueba', description: 'Desde el cabo', alt: 'Un pixel', discipline: 'Pintura', technique: 'acuarela', license: 'CC0', location: null, ownTags: ['faro', 'mar'] } })
    expect((await placesApi.query({ criterio: WORLD })).items.some(item => item.publicacion.id === postId)).toBe(false)
    await expect(placesApi.detail(postId)).rejects.toMatchObject({ status: 404 })

    repo.logout()
    await expect(placesApi.query({ criterio: WORLD })).rejects.toBeInstanceOf(ApiError)
    await expect(placesApi.query({ criterio: WORLD })).rejects.toMatchObject({ status: 401 })
  }, 60000)
})

// Fase 10 (T086, T087, T089): flujos completos contra el servicio real.
describe.skipIf(!live)('flujos de la fase 10 contra el servicio real', () => {
  const setup = async () => {
    const api = await import('./api')
    const fetchOriginal = globalThis.fetch
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => fetchOriginal(typeof input === 'string' && input.startsWith('/') ? `http://localhost:8080${input}` : input, init)) as typeof fetch
    const repo = new api.ApiRepository()
    const register = (name: string) => {
      const suffix = `${name}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
      return repo.register({ email: `${suffix}@gmail.com`, username: suffix.slice(0, 24), nombreCompleto: 'Prueba Fase Diez', password: 'ClaveSegura123!' })
    }
    const post = (id: string, location: { latitud: number; longitud: number } | null) => ({
      id, title: `Obra ${id}`, description: 'Prueba', alt: 'Un pixel', discipline: 'Pintura' as const, technique: 'acuarela', kind: 'image' as const,
      src: IMAGE, cover: '', width: 1, height: 1, duration: 0, license: 'CC0', credit: '', creditUrl: '', challengeId: null, location, ownTags: [] as string[],
    })
    return { ...api, repo, register, post }
  }
  const ids = (page: { items: { publicacion: { id: string } }[] }) => page.items.map(item => item.publicacion.id)

  it('T086: con y sin ubicación siguen en perfil y búsqueda; solo la ubicada está en mapa y lista', async () => {
    const { repo, register, post, placesApi } = await setup()
    const userId = await register('t086')
    await repo.execute(userId, { type: 'create-post', post: post('sin-lugar', null) })
    await repo.execute(userId, { type: 'create-post', post: post('con-lugar', { latitud: -34.6, longitud: -58.4 }) })
    const [sin, con] = [repo.resolveId('sin-lugar'), repo.resolveId('con-lugar')]

    const state = await repo.load()
    expect(state.posts.filter(item => item.authorId === userId).map(item => item.id)).toEqual(expect.arrayContaining([sin, con]))
    expect(state.posts.find(item => item.id === con)?.location).toEqual({ latitud: -34.6, longitud: -58.4 })
    expect(state.posts.find(item => item.id === sin)?.location ?? null).toBeNull()

    const map = ids(await placesApi.query({ criterio: WORLD, limite: 20 }))
    expect(map).toContain(con)
    expect(map).not.toContain(sin)
    expect((await placesApi.detail(con)).id).toBe(con)
    await expect(placesApi.detail(sin)).rejects.toMatchObject({ status: 404 })
  }, 60000)

  it('T087: radio, páginas sin duplicados y límites; sin preferencia no hay cercanía', async () => {
    const { repo, register, post, placesApi } = await setup()
    const userId = await register('t087')
    for (const [n, lon] of [['a', -58.4], ['b', -58.41], ['c', -58.42]] as const) {
      await repo.execute(userId, { type: 'create-post', post: post(`p-${n}`, { latitud: -34.6, longitud: lon }) })
    }
    const mine = ['a', 'b', 'c'].map(n => repo.resolveId(`p-${n}`))
    const centro = { latitud: -34.6, longitud: -58.4 }

    await expect(placesApi.query({ criterio: { modo: 'RADIO', centro, radioKm: 10 } })).rejects.toMatchObject({ status: 403 })
    await placesApi.preference.set('ACTIVADA')
    await expect(placesApi.query({ criterio: { modo: 'RADIO', centro, radioKm: 0 } })).rejects.toMatchObject({ status: 400 })
    await expect(placesApi.query({ criterio: { modo: 'RADIO', centro, radioKm: 101 } })).rejects.toMatchObject({ status: 400 })
    expect(ids(await placesApi.query({ criterio: { modo: 'RADIO', centro, radioKm: 100 }, limite: 100 }))).toEqual(expect.arrayContaining(mine))

    const seen: string[] = []
    let cursor: string | null = null
    do {
      const page: Awaited<ReturnType<typeof placesApi.query>> = await placesApi.query({ criterio: { modo: 'RADIO', centro, radioKm: 25 }, limite: 2, cursor })
      seen.push(...ids(page))
      cursor = page.nextCursor
    } while (cursor)
    expect(new Set(seen).size).toBe(seen.length)
    expect(seen).toEqual(expect.arrayContaining(mine))

    expect(ids(await placesApi.query({ criterio: WORLD, limite: 100 }))).toEqual(expect.arrayContaining(mine))
  }, 90000)

  it('T089: reporte aceptado retira del mapa la obra ubicada y deja auditoría; el flujo legado sin ubicación sigue igual', async () => {
    const { repo, register, post, placesApi, adminActivity } = await setup()
    const author = await register('t089a')
    await repo.execute(author, { type: 'create-post', post: post('rep-lugar', { latitud: -34.6, longitud: -58.4 }) })
    await repo.execute(author, { type: 'create-post', post: post('rep-legado', null) })
    const [located, legacy] = [repo.resolveId('rep-lugar'), repo.resolveId('rep-legado')]
    repo.logout()

    const reporter = await register('t089r')
    expect(ids(await placesApi.query({ criterio: WORLD, limite: 100 }))).toContain(located)
    for (const [id, postId] of [['rep-1', located], ['rep-2', legacy]] as const) {
      await repo.execute(reporter, { type: 'create-report', report: { id, postId, reason: 'Spam', description: 'Contenido repetido y sin relación.' } })
    }
    repo.logout()

    const admin = await repo.login('admin@inspiraboard.com', 'AdminPassword123!')
    const reports = (await repo.load()).reports
    for (const postId of [located, legacy]) {
      const report = reports.find(item => item.postId === postId)
      expect(report).toBeDefined()
      await repo.execute(admin, { type: 'review-report', reportId: report!.id, status: 'accepted', note: 'Infracción confirmada.' })
    }
    expect(ids(await placesApi.query({ criterio: WORLD, limite: 100 }))).not.toContain(located)
    await expect(placesApi.detail(located)).rejects.toMatchObject({ status: 404 })
    const activity = await adminActivity.page(0)
    expect(activity.items.length).toBeGreaterThan(0)
    expect(JSON.stringify(activity.items)).toMatch(/REPORT_ACCEPTED|aceptad/i)
    repo.logout()

    await register('t089v')
    expect(ids(await placesApi.query({ criterio: WORLD, limite: 100 }))).not.toContain(located)
    expect((await repo.load()).posts.some(item => item.id === legacy && item.status === 'published')).toBe(false)
  }, 90000)
})
