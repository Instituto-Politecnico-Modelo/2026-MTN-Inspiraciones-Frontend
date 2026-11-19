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

  await screen.findByRole('option', { name: /Canción de prueba.*Artista de prueba/ })
  fireEvent.change(screen.getByLabelText('Recurso disponible'), { target: { value: '8' } })
  fireEvent.click(screen.getByRole('button', { name: 'Vincular a la publicación' }))
  expect(await screen.findByText('Ver letra de referencia')).toBeInTheDocument()
  expect(fetch.mock.calls.find(([, request]) => request?.method === 'PUT')).toEqual([
    '/api/publicaciones/obra-1/inspiraciones', expect.objectContaining({ body: '{"tipoRecurso":"cancion","id":8}' }),
  ])
  expect(fetch.mock.calls.every(([, request]) => request?.method !== 'POST')).toBe(true)
  expect(screen.queryByRole('option', { name: /Canción de prueba.*Artista de prueba/ })).toBeNull()
})

it('filtra y pagina los sonidos guardados por separado de las canciones', async () => {
  const fetch = vi.fn(async (path: string) => Response.json(
    path.includes('pagina=2') ? { items: [sound] }
      : path.includes('q=lluvia') ? { items: [], siguientePagina: 2 }
        : path.includes('recursos-musicales') ? { items: [song] } : [],
  ))
  vi.stubGlobal('fetch', fetch)
  render(<MusicInspirations postId="obra-2" editable />)
  await screen.findByRole('option', { name: /Canción de prueba.*Artista de prueba/ })

  fireEvent.change(screen.getByLabelText('Tipo de referencia'), { target: { value: 'sample' } })
  fireEvent.change(screen.getByLabelText('Filtrar catálogo'), { target: { value: 'lluvia' } })
  fireEvent.click(screen.getByRole('button', { name: 'Buscar en catálogo' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Siguiente página' }))
  expect(await screen.findByRole('option', { name: /Lluvia.*2[,.]5/ })).toBeInTheDocument()
  expect(fetch.mock.calls.some(([path]) => path.includes('tipoRecurso=sample') && path.includes('q=lluvia') && path.includes('pagina=2'))).toBe(true)
})

it('solo carga el catálogo para el autor', async () => {
  const fetch = vi.fn(async () => Response.json([]))
  vi.stubGlobal('fetch', fetch)
  render(<MusicInspirations postId="obra-3" editable={false} />)
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  expect(screen.queryByLabelText('Tipo de referencia')).not.toBeInTheDocument()
})
