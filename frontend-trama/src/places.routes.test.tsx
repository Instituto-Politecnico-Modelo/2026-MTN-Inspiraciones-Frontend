import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppRoutes } from './App'
import { placesApi } from './data/api'
import { DemoRepository } from './data/repository'

const catalog = [
  { codigo: 'ILUSTRACION', nombre: 'Ilustración', tecnicas: [{ codigo: 'ILUSTRACION_DIGITAL', nombre: 'digital' }, { codigo: 'ILUSTRACION_TRADICIONAL', nombre: 'tradicional' }] },
  { codigo: 'PINTURA', nombre: 'Pintura', tecnicas: [{ codigo: 'PINTURA_ACUARELA', nombre: 'acuarela' }, { codigo: 'PINTURA_GUACHE', nombre: 'guache' }, { codigo: 'PINTURA_GRAFITO', nombre: 'grafito' }] },
]

let repository: DemoRepository
let router: ReturnType<typeof createMemoryRouter> | undefined

beforeEach(() => {
  sessionStorage.clear()
  repository = new DemoRepository(`trama-places-${crypto.randomUUID()}`)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(placesApi, 'catalog').mockResolvedValue(catalog)
})

afterEach(async () => {
  cleanup()
  router?.dispose()
  await repository.close()
  sessionStorage.clear()
  vi.restoreAllMocks()
})

function openRoute(path: string) {
  sessionStorage.setItem('trama-demo-profile', 'mora')
  router = createMemoryRouter(createAppRoutes(repository), { initialEntries: [path] })
  render(<RouterProvider router={router} />)
}

vi.setConfig({ testTimeout: 20000 })

describe('formulario de publicación con lugar, técnica y tags (FR-002/015/018/019)', () => {
  it('ofrece solo las técnicas de la disciplina elegida', async () => {
    openRoute('/publicar')
    await screen.findByRole('heading', { name: 'Publicar obra' })

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Disciplina' }), 'Pintura')
    const technique = await screen.findByRole('combobox', { name: 'Técnica (opcional)' })
    expect(within(technique).getAllByRole('option').map(option => option.textContent)).toEqual(['Sin técnica', 'acuarela', 'guache', 'grafito'])

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Disciplina' }), 'Ilustración')
    expect(within(screen.getByRole('combobox', { name: 'Técnica (opcional)' })).queryByRole('option', { name: 'acuarela' })).not.toBeInTheDocument()
  })

  it('permite de cero a tres tags propios con contador y rechaza el cuarto', async () => {
    openRoute('/publicar')
    await screen.findByRole('heading', { name: 'Publicar obra' })
    const input = screen.getByRole('textbox', { name: 'Tags propios (opcional)' })
    expect(screen.getByText('0/3')).toBeVisible()

    for (const tag of ['mar', 'faro', 'playa']) {
      await userEvent.type(input, tag)
      await userEvent.click(screen.getByRole('button', { name: 'Agregar tag' }))
    }
    expect(screen.getByText('3/3')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Quitar tag mar' })).toBeVisible()

    await userEvent.type(input, 'cuarto')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar tag' }))
    expect(screen.getByText('3/3')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent(/hasta 3/)
    expect(screen.queryByRole('button', { name: 'Quitar tag cuarto' })).not.toBeInTheDocument()
  })

  it('no repite tags que se vuelven iguales al normalizarse', async () => {
    openRoute('/publicar')
    await screen.findByRole('heading', { name: 'Publicar obra' })
    const input = screen.getByRole('textbox', { name: 'Tags propios (opcional)' })

    for (const tag of ['Mar', ' mar ']) {
      await userEvent.type(input, tag)
      await userEvent.click(screen.getByRole('button', { name: 'Agregar tag' }))
    }

    expect(screen.getByText('1/3')).toBeVisible()
  })

  it('el lugar es opcional y valida las coordenadas del punto elegido', async () => {
    openRoute('/publicar')
    await screen.findByRole('heading', { name: 'Publicar obra' })

    const group = screen.getByRole('group', { name: 'Lugar de inspiración (opcional)' })
    expect(within(group).getByRole('textbox', { name: 'Latitud' })).toHaveValue('')
    await userEvent.type(within(group).getByRole('textbox', { name: 'Latitud' }), '91')
    await userEvent.type(within(group).getByRole('textbox', { name: 'Longitud' }), '10')

    expect(within(group).getByRole('alert')).toHaveTextContent(/latitud/i)
  })
})

describe('filtros de disciplina y técnica en Descubrir (FR-017-020)', () => {
  it('las técnicas dependen del catálogo de la disciplina elegida y conservan los filtros previos', async () => {
    openRoute('/descubrir?disciplina=Pintura')
    await screen.findByRole('heading', { name: 'Descubrir' })

    const technique = await screen.findByRole('combobox', { name: 'Técnica' })
    expect(within(technique).getAllByRole('option').map(option => option.textContent)).toEqual(['Todos', 'acuarela', 'guache', 'grafito'])
    expect(screen.getByRole('combobox', { name: 'Orden' })).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Disciplina' })).toHaveValue('Pintura')
  })
})
