import { describe, expect, it } from 'vitest'
import { applyCommand, createSeed, privateFolders, searchPosts, toCsv, validateFile, visiblePosts } from './store'

const now = '2026-10-29T18:00:00.000Z'
const seed = () => createSeed(now)

describe('interacciones y privacidad de la demo', () => {
  it('alterna likes sin duplicados ni mutaciones del estado anterior', () => {
    const original = seed()
    const liked = applyCommand(original, 'mora', { type: 'toggle-like', postId: 'obra-1' }, now)
    expect(liked.posts.find(p => p.id === 'obra-1')?.likes).toContain('mora')
    expect(original.posts.find(p => p.id === 'obra-1')?.likes).not.toContain('mora')
    const unliked = applyCommand(liked, 'mora', { type: 'toggle-like', postId: 'obra-1' }, now)
    expect(unliked.posts.find(p => p.id === 'obra-1')?.likes).not.toContain('mora')
  })

  it('exige una cuenta activa para interactuar', () => {
    expect(() => applyCommand(seed(), null, { type: 'toggle-like', postId: 'obra-1' }, now)).toThrow(/ingresar/i)
    expect(() => applyCommand(seed(), 'ines', { type: 'toggle-like', postId: 'obra-1' }, now)).toThrow(/suspendida/i)
  })

  it('no permite seguirse ni duplicar un seguimiento', () => {
    expect(() => applyCommand(seed(), 'mora', { type: 'toggle-follow', userId: 'mora' }, now)).toThrow(/seguir.*propio/i)
    const once = applyCommand(seed(), 'mora', { type: 'toggle-follow', userId: 'nico' }, now)
    expect(once.follows.filter(f => f.followerId === 'mora' && f.followingId === 'nico')).toHaveLength(1)
    const twice = applyCommand(once, 'mora', { type: 'toggle-follow', userId: 'nico' }, now)
    expect(twice.follows.filter(f => f.followerId === 'mora' && f.followingId === 'nico')).toHaveLength(0)
  })

  it('bloquea y desbloquea cuentas retirando los seguimientos entre ambas', () => {
    expect(() => applyCommand(seed(), 'mora', { type: 'toggle-block', userId: 'mora' }, now)).toThrow(/bloquear.*propia/i)
    const blocked = applyCommand(seed(), 'mora', { type: 'toggle-block', userId: 'lara' }, now)
    expect(blocked.blocks).toEqual([{ blockerId: 'mora', blockedId: 'lara' }])
    expect(blocked.follows.some(f => f.followerId === 'mora' && f.followingId === 'lara')).toBe(false)
    expect(applyCommand(blocked, 'mora', { type: 'toggle-block', userId: 'lara' }, now).blocks).toHaveLength(0)
  })

  it('mantiene las carpetas privadas incluso frente a otra cuenta administradora', () => {
    expect(privateFolders(seed(), 'mora', 'mora')).toHaveLength(2)
    expect(privateFolders(seed(), 'mora', 'lara')).toHaveLength(0)
    expect(privateFolders(seed(), 'mora', 'admin')).toHaveLength(0)
    expect(() => applyCommand(seed(), 'lara', { type: 'save-to-folder', folderId: 'carpeta-color', postId: 'obra-1' }, now)).toThrow(/carpeta/i)
  })

  it('guarda sin duplicar y no confunde un guardado con un like', () => {
    const once = applyCommand(seed(), 'mora', { type: 'save-to-folder', folderId: 'carpeta-color', postId: 'obra-3' }, now)
    const twice = applyCommand(once, 'mora', { type: 'save-to-folder', folderId: 'carpeta-color', postId: 'obra-3' }, now)
    expect(twice.folders.find(f => f.id === 'carpeta-color')?.postIds.filter(id => id === 'obra-3')).toHaveLength(1)
    expect(twice.posts.find(p => p.id === 'obra-3')?.likes).toEqual(seed().posts.find(p => p.id === 'obra-3')?.likes)
  })

  it('rechaza carpetas de nombre vacío o repetido y elimina solo la carpeta', () => {
    expect(() => applyCommand(seed(), 'mora', { type: 'create-folder', id: 'nueva', name: ' ' }, now)).toThrow()
    expect(() => applyCommand(seed(), 'mora', { type: 'create-folder', id: 'nueva', name: ' COLOR Y FORMA ' }, now)).toThrow(/existe/i)
    const result = applyCommand(seed(), 'mora', { type: 'delete-folder', folderId: 'carpeta-color' }, now)
    expect(result.folders.some(f => f.id === 'carpeta-color')).toBe(false)
    expect(result.posts).toHaveLength(seed().posts.length)
  })

  it('valida comentarios y mantiene el contenido como texto, no HTML', () => {
    expect(() => applyCommand(seed(), 'mora', { type: 'add-comment', id: 'c-nuevo', postId: 'obra-1', text: '   ' }, now)).toThrow()
    const result = applyCommand(seed(), 'mora', { type: 'add-comment', id: 'c-nuevo', postId: 'obra-1', text: '  <b>Hermoso</b>  ' }, now)
    expect(result.posts.find(p => p.id === 'obra-1')?.comments.at(-1)?.text).toBe('<b>Hermoso</b>')
  })

  it('no permite editar datos privados o roles mediante el perfil', () => {
    const untrustedProfile = { ...seed().users[0], role: 'admin' }
    expect(() => applyCommand(seed(), 'mora', { type: 'update-profile', changes: untrustedProfile }, now)).toThrow()
    expect(() => applyCommand(seed(), 'mora', {
      type: 'update-profile',
      changes: { name: 'Mora', handle: 'moravidal', bio: '', location: '', website: 'javascript:alert(1)', disciplines: ['Ilustración'], avatar: '' },
    }, now)).toThrow()
  })

  it('busca sin distinguir mayúsculas o tildes y filtra por medio', () => {
    expect(searchPosts(seed(), { query: 'CORRIENTE', kind: 'image' }).map(p => p.id)).toContain('obra-1')
    expect(searchPosts(seed(), { query: '', kind: 'audio' }).every(p => p.kind === 'audio')).toBe(true)
    expect(searchPosts(seed(), { query: 'zzzz-no-existe' })).toHaveLength(0)
  })
})

describe('moderación y desafíos', () => {
  it('impide acciones administrativas a visitantes y artistas', () => {
    expect(() => applyCommand(seed(), 'mora', { type: 'moderate-post', postId: 'obra-1', status: 'hidden', reason: 'Revisión' }, now)).toThrow(/administrador/i)
    expect(() => applyCommand(seed(), 'mora', { type: 'change-role', userId: 'lara', role: 'admin' }, now)).toThrow(/administrador/i)
  })

  it('no permite suspender, eliminar o degradar la propia cuenta administradora', () => {
    expect(() => applyCommand(seed(), 'admin', { type: 'set-user-status', userId: 'admin', status: 'suspended', reason: 'Prueba' }, now)).toThrow(/propia cuenta/i)
    expect(() => applyCommand(seed(), 'admin', { type: 'change-role', userId: 'admin', role: 'artist' }, now)).toThrow(/propia cuenta/i)
  })

  it('oculta publicaciones moderadas en todas las selecciones públicas', () => {
    const result = applyCommand(seed(), 'admin', { type: 'moderate-post', postId: 'obra-1', status: 'hidden', reason: 'Revisar autoría' }, now)
    expect(visiblePosts(result).some(p => p.id === 'obra-1')).toBe(false)
    expect(searchPosts(result, { query: 'Corriente' })).toHaveLength(0)
    expect(() => applyCommand(result, 'mora', { type: 'toggle-like', postId: 'obra-1' }, now)).toThrow(/disponible/i)
    expect(result.audit.at(-1)?.actorId).toBe('admin')
  })

  it('oculta las obras de una cuenta suspendida y las recupera al reactivarla', () => {
    const suspended = applyCommand(seed(), 'admin', { type: 'set-user-status', userId: 'lara', status: 'suspended', reason: 'Revisión de ejemplo' }, now)
    expect(visiblePosts(suspended).some(p => p.authorId === 'lara')).toBe(false)
    const restored = applyCommand(suspended, 'admin', { type: 'set-user-status', userId: 'lara', status: 'active', reason: 'Revisión resuelta' }, now)
    expect(visiblePosts(restored).some(p => p.authorId === 'lara')).toBe(true)
  })

  it('resolver un reporte es terminal y su aceptación oculta la obra', () => {
    const result = applyCommand(seed(), 'admin', { type: 'review-report', reportId: 'reporte-1', status: 'accepted', note: 'Se oculta mientras se verifica la autoría.' }, now)
    expect(result.reports.find(r => r.id === 'reporte-1')?.status).toBe('accepted')
    expect(visiblePosts(result).some(p => p.id === 'obra-10')).toBe(false)
    expect(() => applyCommand(result, 'admin', { type: 'review-report', reportId: 'reporte-1', status: 'dismissed', note: 'Otra decisión' }, now)).toThrow(/resuelto/i)
  })

  it('aprobar una propuesta no publica un desafío ni permite resolverla de nuevo', () => {
    const result = applyCommand(seed(), 'admin', { type: 'review-request', requestId: 'solicitud-1', status: 'approved', note: 'Buena consigna para la comunidad.' }, now)
    expect(result.requests.find(r => r.id === 'solicitud-1')?.status).toBe('approved')
    expect(result.challenges).toHaveLength(seed().challenges.length)
    expect(() => applyCommand(result, 'admin', { type: 'review-request', requestId: 'solicitud-1', status: 'rejected', note: 'Cambio' }, now)).toThrow(/resuelta/i)
  })

  it('participar exige una obra propia y un desafío abierto', () => {
    expect(() => applyCommand(seed(), 'mora', { type: 'join-challenge', challengeId: 'desafio-cerrado', postId: 'obra-3' }, now)).toThrow(/abierto/i)
    expect(() => applyCommand(seed(), 'mora', { type: 'join-challenge', challengeId: 'desafio-linea', postId: 'obra-1' }, now)).toThrow(/propia/i)
    const result = applyCommand(seed(), 'mora', { type: 'join-challenge', challengeId: 'desafio-linea', postId: 'obra-3' }, now)
    expect(result.posts.find(p => p.id === 'obra-3')?.challengeId).toBe('desafio-linea')
  })

  it('una apelación aceptada reactiva la cuenta suspendida', () => {
    const result = applyCommand(seed(), 'admin', { type: 'review-appeal', appealId: 'apelacion-1', status: 'approved', note: 'La revisión confirmó la autoría.' }, now)
    expect(result.users.find(u => u.id === 'ines')?.status).toBe('active')
    expect(result.appeals[0].status).toBe('approved')
  })
})

describe('límites de archivos y exportación', () => {
  it('admite imágenes hasta 8 MiB y audio hasta 16 MiB, inclusive', () => {
    expect(validateFile({ type: 'image/png', size: 8 * 1024 * 1024 })).toBe('image')
    expect(validateFile({ type: 'audio/mpeg', size: 16 * 1024 * 1024 })).toBe('audio')
    expect(() => validateFile({ type: 'image/png', size: 8 * 1024 * 1024 + 1 })).toThrow(/8 MB/)
    expect(() => validateFile({ type: 'audio/wav', size: 16 * 1024 * 1024 + 1 })).toThrow(/16 MB/)
    expect(() => validateFile({ type: 'image/svg+xml', size: 100 })).toThrow(/formato/i)
    expect(() => validateFile({ type: 'image/png', size: 0 })).toThrow(/vacío/i)
  })

  it('neutraliza fórmulas de CSV y conserva comillas, comas y saltos de línea', () => {
    const csv = toCsv([['Nombre', 'Texto'], ['=SUM(1,2)', 'a"b\nc'], [' \t+CMD', '@dato']])
    expect(csv).toContain(`"'=SUM(1,2)"`)
    expect(csv).toContain('"a""b\nc"')
    expect(csv).toContain(`"' \t+CMD"`)
    expect(csv).toContain(`"'@dato"`)
  })
})
