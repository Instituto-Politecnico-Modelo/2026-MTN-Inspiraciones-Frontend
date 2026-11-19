import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MusicInspirations } from './MusicInspirations'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const song = { id: 8, titulo: 'Canción de prueba', artista: 'Artista de prueba' }
const sound = { id: 24, titulo: 'Lluvia', duracionSegundos: 2.5 }

it('permite elegir una canción guardada y vincularla sin consultar al proveedor', async () => {
  const fetch = vi.fn(async (path: string, init?: RequestInit) => Response.json(
    init?.method === 'PUT' ? { ...song, tipoRecurso: 'cancion', letraCompleta: 'Letra de prueba' }
      : path.includes('recursos-musicales') ? { items: [song] } : [],
  ))
  vi.stubGlobal('fetch', fetch)
  render(<MusicInspirations postId="obra-1" editable />)

  const list = await screen.findByRole('list', { name: 'Resultados del catálogo' })
  expect(list).toHaveTextContent('Canción de prueba')
  expect(list).toHaveTextContent('Artista de prueba')
  fireEvent.click(screen.getByRole('button', { name: 'Vincular Canción de prueba' }))
  expect(await screen.findByText('Ver letra de referencia')).toBeInTheDocument()
  expect(fetch.mock.calls.find(([, request]) => request?.method === 'PUT')).toEqual([
    '/api/publicaciones/obra-1/inspiraciones', expect.objectContaining({ body: '{"tipoRecurso":"cancion","id":8}' }),
  ])
  expect(fetch.mock.calls.every(([, request]) => request?.method !== 'POST')).toBe(true)
  expect(screen.getByText('Vinculado')).toBeVisible()
})

it('filtra y pagina los sonidos guardados por separado de las canciones', async () => {
  const fetch = vi.fn(async (path: string) => Response.json(
    path.includes('/buscar?') ? []
      : path.includes('pagina=2') ? { items: [sound] }
      : path.includes('q=lluvia') ? { items: [{ id: 18, titulo: 'Lluvia en el techo' }], siguientePagina: 2 }
        : path.includes('recursos-musicales') ? { items: [song] } : [],
  ))
  vi.stubGlobal('fetch', fetch)
  render(<MusicInspirations postId="obra-2" editable />)
  await screen.findByRole('button', { name: 'Vincular Canción de prueba' })

  fireEvent.click(screen.getByRole('button', { name: 'Sonidos' }))
  fireEvent.change(screen.getByLabelText('Filtrar catálogo'), { target: { value: 'lluvia' } })
  fireEvent.click(screen.getByRole('button', { name: 'Buscar en catálogo' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Siguiente página' }))
  expect(await screen.findByRole('button', { name: 'Vincular Lluvia' })).toBeInTheDocument()
  expect(screen.getByText(/^2[,.]5 s$/)).toBeVisible()
  expect(fetch.mock.calls.some(([path]) => path.includes('tipoRecurso=sample') && path.includes('q=lluvia') && path.includes('pagina=2'))).toBe(true)
})

it('muestra una canción nueva del proveedor y la importa solo al vincularla', async () => {
  const suggestion = { id: 489, titulo: 'Canción nueva', artista: 'Artista nuevo' }
  const resolved = { ...suggestion, id: 101, tipoRecurso: 'cancion', letraCompleta: 'Letra de prueba' }
  const fetch = vi.fn(async (path: string, init?: RequestInit) => Response.json(
    init?.method === 'POST' || init?.method === 'PUT' ? resolved
      : path.includes('/buscar?') ? [suggestion] : path.includes('recursos-musicales') ? { items: [] } : [],
  ))
  vi.stubGlobal('fetch', fetch)
  render(<MusicInspirations postId="obra-4" editable />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Buscar en catálogo' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Filtrar catálogo'), { target: { value: 'Canción' } })
  fireEvent.click(screen.getByRole('button', { name: 'Buscar en catálogo' }))
  const action = await screen.findByRole('button', { name: 'Vincular Canción nueva' })
  expect(screen.getByRole('list', { name: 'Resultados externos' })).toHaveTextContent('Artista nuevo')
  expect(fetch.mock.calls.every(([, init]) => init?.method !== 'POST')).toBe(true)
  fireEvent.click(action)
  expect(await screen.findByText('Ver letra de referencia')).toBeVisible()
  expect(fetch.mock.calls.find(([, request]) => request?.method === 'PUT')?.[1]?.body)
    .toBe('{"tipoRecurso":"cancion","id":101}')
})

it('solo carga el catálogo para el autor', async () => {
  const fetch = vi.fn(async () => Response.json([]))
  vi.stubGlobal('fetch', fetch)
  render(<MusicInspirations postId="obra-3" editable={false} />)
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  expect(screen.queryByLabelText('Tipo de referencia')).not.toBeInTheDocument()
})
