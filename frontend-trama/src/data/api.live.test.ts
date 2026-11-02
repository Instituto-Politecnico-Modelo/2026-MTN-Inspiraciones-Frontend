// Prueba de integración contra el servicio real. Se ejecuta con: TRAMA_LIVE=1 npx vitest run src/data/api.live.test.ts
import { describe, expect, it } from 'vitest'

const live = !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.TRAMA_LIVE

const IMAGE = '/api/imagenes/b25e8763-ef29-4d6f-b733-f053252ecb00.png'

describe.skipIf(!live)('ApiRepository contra el servicio real', () => {
  it('recorre el flujo de una persona y de la administración', async () => {
    const { ApiRepository } = await import('./api')
    const fetchOriginal = globalThis.fetch
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => fetchOriginal(typeof input === 'string' && input.startsWith('/') ? `http://localhost:8080${input}` : input, init)) as typeof fetch
    const repo = new ApiRepository()
    const suffix = Date.now().toString(36)
    const email = `live.${suffix}@gmail.com`
    const userId = await repo.register({ email, username: `live${suffix}`.slice(0, 24), nombreCompleto: 'Prueba Integracion', password: 'ClaveSegura123!' })
    let state = await repo.load()
    const me = state.users.find(user => user.id === userId)
    expect(me?.email).toBe(email)

    await repo.execute(userId, { type: 'update-profile', changes: { name: 'Prueba Integracion', handle: me?.handle ?? '', bio: 'Bio de prueba', location: 'Rosario', website: 'https://example.com', avatar: '', disciplines: ['Pintura'] } })
    await repo.execute(userId, { type: 'set-interests', disciplines: ['Pintura', 'Música'], inspirations: ['Naturaleza'] })
    state = await repo.load()
    const profile = state.users.find(user => user.id === userId)
    expect(profile).toMatchObject({ bio: 'Bio de prueba', location: 'Rosario', website: 'https://example.com', disciplines: ['Pintura', 'Música'], inspirations: ['Naturaleza'] })

    await repo.execute(userId, { type: 'create-post', post: { id: 'obra-local-1', title: 'Obra de integración', description: 'Primera línea\nsegunda', alt: 'Un pixel', discipline: 'Pintura', technique: 'Óleo', kind: 'image', src: IMAGE, cover: '', width: 1, height: 1, duration: 0, license: 'CC0', credit: '', creditUrl: '', challengeId: null } })
    const postId = repo.resolveId('obra-local-1')
    state = await repo.load()
    const post = state.posts.find(item => item.id === postId)
    expect(post).toMatchObject({ title: 'Obra de integración', description: 'Primera línea\nsegunda', discipline: 'Pintura', technique: 'Óleo', license: 'CC0', authorId: userId })
    expect(post?.src).toMatch(/\/api\/imagenes\//)

    await repo.execute(userId, { type: 'update-post', postId, changes: { title: 'Obra editada', description: 'x', alt: 'Otro texto', discipline: 'Pintura', technique: '', license: 'CC0' } })
    await repo.execute(userId, { type: 'add-comment', id: 'c-1', postId, text: 'Un comentario' })
    await repo.execute(userId, { type: 'toggle-like', postId })
    await repo.execute(userId, { type: 'create-folder', id: 'carpeta-local-1', name: 'Referencias' })
    await repo.execute(userId, { type: 'save-to-folder', folderId: 'carpeta-local-1', postId })
    state = await repo.load()
    const edited = state.posts.find(item => item.id === postId)
    expect(edited?.title).toBe('Obra editada')
    expect(edited?.comments.map(comment => comment.text)).toEqual(['Un comentario'])
    expect(edited?.likes).toContain(userId)
    const folder = state.folders.find(item => item.id === repo.resolveId('carpeta-local-1'))
    expect(folder?.postIds).toContain(postId)

    await repo.execute(userId, { type: 'create-request', request: { id: 's-1', title: 'Propuesta de prueba', description: 'Una consigna de prueba para la comunidad.', discipline: 'Pintura' } })
    state = await repo.load()
    expect(state.requests.some(request => request.title === 'Propuesta de prueba' && request.status === 'pending')).toBe(true)

    repo.logout()
    const adminId = await repo.login('admin@inspiraboard.com', 'AdminPassword123!')
    await repo.execute(adminId, { type: 'create-report', report: { id: 'r-1', postId, reason: 'Spam', description: 'Reporte de prueba de integración' } })
    state = await repo.load()
    expect(state.users.find(user => user.id === adminId)?.role).toBe('admin')
    expect(state.users.some(user => user.id === userId)).toBe(true)
    const report = state.reports.find(item => item.postId === postId)
    expect(report?.status).toBe('pending')
    await repo.execute(adminId, { type: 'review-report', reportId: report?.id ?? '', status: 'dismissed', note: 'Sin motivos para actuar.' })
    state = await repo.load()
    expect(state.reports.find(item => item.id === report?.id)?.status).toBe('dismissed')
    const request = state.requests.find(item => item.title === 'Propuesta de prueba')
    await repo.execute(adminId, { type: 'review-request', requestId: request?.id ?? '', status: 'rejected', note: 'No por ahora' })
    await repo.execute(userId === adminId ? adminId : adminId, { type: 'set-user-status', userId, status: 'suspended', reason: 'Prueba de suspensión' })
    state = await repo.load()
    expect(state.users.find(user => user.id === userId)?.status).toBe('suspended')
    await repo.execute(adminId, { type: 'set-user-status', userId, status: 'active', reason: 'Fin de la prueba' })
    await repo.execute(adminId, { type: 'toggle-block', userId })
    state = await repo.load()
    expect(state.blocks).toEqual([{ blockerId: adminId, blockedId: userId }])
    await repo.execute(adminId, { type: 'toggle-block', userId })
    state = await repo.load()
    expect(state.blocks).toEqual([])
    await repo.execute(adminId, { type: 'moderate-post', postId, status: 'deleted', reason: 'Limpieza de prueba' })
    state = await repo.load()
    expect(state.posts.find(item => item.id === postId)?.status).not.toBe('published')
  }, 60000)
})
