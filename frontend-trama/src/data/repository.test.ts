import { afterEach, describe, expect, it, vi } from 'vitest'
import { DemoRepository } from './repository'

const repositories: DemoRepository[] = []
const repo = () => {
  const repository = new DemoRepository(`trama-test-${crypto.randomUUID()}`)
  repositories.push(repository)
  return repository
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(repositories.splice(0).map(r => r.close()))
})

describe('persistencia transaccional', () => {
  it('conserva un cambio al volver a cargar desde IndexedDB', async () => {
    const repository = repo()
    await repository.load()
    await repository.execute('mora', { type: 'create-folder', id: 'persistente', name: 'Referencias nuevas' })
    const reloaded = await repository.load()
    expect(reloaded.folders.some(f => f.id === 'persistente')).toBe(true)
    expect(reloaded.revision).toBe(1)
  })

  it('serializa escrituras simultáneas sin perder ninguna', async () => {
    const repository = repo()
    await repository.load()
    await Promise.all([
      repository.execute('mora', { type: 'toggle-like', postId: 'obra-1' }),
      repository.execute('mora', { type: 'toggle-like', postId: 'obra-2' }),
    ])
    const state = await repository.load()
    expect(state.posts.find(p => p.id === 'obra-1')?.likes).toContain('mora')
    expect(state.posts.find(p => p.id === 'obra-2')?.likes).toContain('mora')
    expect(state.revision).toBe(2)
  })

  it('rechaza una escritura fallida sin mostrarla como persistida', async () => {
    const repository = repo()
    await repository.load()
    const write = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('Cuota excedida', 'QuotaExceededError')
    })
    await expect(repository.execute('mora', { type: 'create-folder', id: 'fallida', name: 'No guardada' })).rejects.toThrow()
    write.mockRestore()
    expect((await repository.load()).folders.some(f => f.id === 'fallida')).toBe(false)
  })
})
