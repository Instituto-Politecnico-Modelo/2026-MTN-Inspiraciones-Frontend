import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { WorkInspirations } from './WorkInspirations'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const linked = { id: 'obra-2', titulo: 'Retrato a lápiz', autorId: 'ana', miniaturaUrl: '', tipoContenido: 'image' }
const found = [
  { id: 'obra-1', authorId: 'ana', title: 'Obra actual', thumbnail: '', type: 'image' },
  { id: 'obra-3', authorId: 'luis', title: 'Paisaje urbano', thumbnail: '', type: 'image' },
]

it('busca obras de Trama, excluye la propia y vincula la elegida', async () => {
  const fetch = vi.fn(async (_path: string, init?: RequestInit) => Response.json(
    init?.method === 'PUT' ? { id: 'obra-3', titulo: 'Paisaje urbano', autorId: 'luis', miniaturaUrl: '', tipoContenido: 'image' } : [],
  ))
  vi.stubGlobal('fetch', fetch)
  const searchWorks = vi.fn(async (_filters: { query: string }) => ({ items: found, cursor: null }))
  render(<MemoryRouter><WorkInspirations postId="obra-1" editable searchWorks={searchWorks} /></MemoryRouter>)

  fireEvent.change(await screen.findByRole('searchbox', { name: 'Buscar una obra de Trama' }), { target: { value: 'paisaje' } })
  fireEvent.click(screen.getByRole('button', { name: 'Buscar obra' }))
  const list = await screen.findByRole('list', { name: 'Obras encontradas' })
  expect(list).not.toHaveTextContent('Obra actual')
  fireEvent.click(screen.getByRole('button', { name: 'Vincular Paisaje urbano como inspiración' }))

  await waitFor(() => expect(screen.getByRole('link', { name: 'Paisaje urbano' })).toHaveAttribute('href', '/obra/obra-3'))
  expect(fetch).toHaveBeenCalledWith('/api/publicaciones/obra-1/obras-inspiracion', expect.objectContaining({
    method: 'PUT', body: '{"obraId":"obra-3"}',
  }))
  expect(searchWorks.mock.calls[0][0]).toMatchObject({ query: 'paisaje' })
})

it('muestra las obras vinculadas y permite quitarlas solo al autor', async () => {
  const fetch = vi.fn(async (_path: string, init?: RequestInit) => init?.method === 'DELETE'
    ? new Response(null, { status: 204 }) : Response.json([linked]))
  vi.stubGlobal('fetch', fetch)
  const { unmount } = render(<MemoryRouter><WorkInspirations postId="obra-1" editable={false} /></MemoryRouter>)
  expect(await screen.findByRole('link', { name: 'Retrato a lápiz' })).toHaveAttribute('href', '/obra/obra-2')
  expect(screen.queryByRole('button', { name: /Quitar/ })).not.toBeInTheDocument()
  unmount()

  render(<MemoryRouter><WorkInspirations postId="obra-1" editable /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Quitar Retrato a lápiz como inspiración' }))
  await waitFor(() => expect(screen.queryByRole('link', { name: 'Retrato a lápiz' })).not.toBeInTheDocument())
  expect(fetch).toHaveBeenCalledWith('/api/publicaciones/obra-1/obras-inspiracion/obra-2', expect.objectContaining({ method: 'DELETE' }))
})
