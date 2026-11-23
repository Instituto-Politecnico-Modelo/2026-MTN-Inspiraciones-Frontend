import { cleanup, render, waitFor } from '@testing-library/react'
import axe from 'axe-core'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppRoutes } from './App'
import { DemoRepository } from './data/repository'

let repository: DemoRepository
let router: ReturnType<typeof createMemoryRouter> | undefined

beforeEach(() => {
  sessionStorage.clear()
  repository = new DemoRepository(`trama-a11y-${crypto.randomUUID()}`)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})

afterEach(async () => {
  cleanup()
  router?.dispose()
  await repository.close()
  sessionStorage.clear()
  vi.restoreAllMocks()
})

vi.setConfig({ testTimeout: 30000 })

async function auditRoute(path: string, profile?: string) {
  if (profile) sessionStorage.setItem('trama-demo-profile', profile)
  router = createMemoryRouter(createAppRoutes(repository), { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  await waitFor(() => expect(document.querySelector('h1')).toBeTruthy(), { timeout: 15000 })
  const result = await axe.run(document.body, {
    // color-contrast necesita un motor de render real; se cubre con axe en navegador.
    rules: { 'color-contrast': { enabled: false } },
    resultTypes: ['violations'],
  })
  return result.violations.map(violation => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map(node => node.target.join(' ')),
  }))
}

describe('auditoría de accesibilidad (axe-core)', () => {
  it.each([
    ['/ingresar', undefined],
    ['/registro', undefined],
    ['/recuperar', undefined],
    ['/acerca', undefined],
    ['/inicio', 'mora'],
    ['/descubrir', 'mora'],
    ['/desafios', 'mora'],
    ['/perfil', 'mora'],
  ])('la ruta %s no tiene violaciones de accesibilidad', async (path, profile) => {
    const violations = await auditRoute(path, profile)
    expect(violations).toEqual([])
  })
})
