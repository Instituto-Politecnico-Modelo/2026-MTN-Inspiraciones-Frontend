import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { MapPublication } from '../data/api'
import type { DemoState, Post } from '../data/model'
import { DiscoverPage } from './Discover'

const { context, music } = vi.hoisted(() => ({
  context: { value: {} as Record<string, unknown> },
  music: { search: vi.fn(), catalog: vi.fn(), resolve: vi.fn() },
}))
const preferenceState = vi.hoisted(() => ({ value: 'DESACTIVADA' as 'ACTIVADA' | 'DESACTIVADA' }))

vi.mock('../context/DemoContext', () => ({ useDemo: () => context.value }))
vi.mock('../lib/useDevicePermission', () => ({ useDevicePermission: () => ['denied'] }))
vi.mock('../data/api', () => ({
  musicalResources: music,
  assetUrl: (value: string) => value,
  placesApi: {
    catalog: async () => [{ codigo: 'fotografia', nombre: 'Fotografía', tecnicas: [{ codigo: 'digital', nombre: 'Digital' }, { codigo: 'analogica', nombre: 'Analógica' }] }],
    preference: { get: async () => preferenceState.value },
  },
}))
vi.mock('../components/FollowButton', () => ({ FollowButton: () => null }))
vi.mock('../components/PostCard', () => ({
  PostGrid: ({ posts }: { posts: Post[] }) => <ul aria-label="Resultados">{posts.map(post => <li key={post.id}>{post.title}</li>)}</ul>,
}))
vi.mock('../components/PlacesExplorer', () => ({
  PlacesExplorer: ({ filter }: { filter: (publication: MapPublication) => boolean }) => <div aria-label="Mapa de resultados">
    {(context.value.state as DemoState).posts.filter(post => filter({ id: post.id, usuarioId: post.authorId })).map(post => <span key={post.id}>{post.title}</span>)}
  </div>,
}))

function Location() {
  return <output aria-label="Dirección">{useLocation().search}</output>
}

beforeEach(() => {
  vi.resetAllMocks()
  preferenceState.value = 'DESACTIVADA'
  window.sessionStorage.clear()
  const author = { id: 'author', role: 'artist', status: 'active', name: 'Ana', handle: 'ana', bio: '', disciplines: ['Fotografía'] }
  const post = (id: string, title: string, extra = {}) => ({
    id, title, authorId: 'author', status: 'published', discipline: 'Fotografía', technique: 'Digital',
    kind: 'image', description: 'Naturaleza', ownTags: [], likes: [], createdAt: '2026-11-25', tutorialUrl: '', ...extra,
  })
  context.value = {
    user: { id: 'viewer' }, searchUsers: vi.fn().mockResolvedValue([author]),
    state: { users: [author], blocks: [], follows: [], posts: [
      post('photo', 'Bosque'),
      post('tutorial', 'Cómo fotografiar', { tutorialUrl: 'https://example.com' }),
      post('painting', 'Pintura', { discipline: 'Pintura', technique: 'Óleo' }),
      post('analog', 'Analógica', { technique: 'Analógica' }),
    ] },
  }
})

afterEach(() => vi.useRealTimers())

const remoteWork = (id: string, title: string) => ({ id, title, authorId: 'author', thumbnail: '', type: 'IMAGEN' })
const advanceSearch = (ms = 300) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

it('usa la API por intención, envía filtros y agrega la página siguiente sin repetir obras', async () => {
  vi.useFakeTimers()
  const first = remoteWork('remote', 'Retrato a lápiz')
  const search = vi.fn().mockResolvedValueOnce({ items: [first], cursor: '1' })
    .mockResolvedValueOnce({ items: [first, remoteWork('other', 'Estudio de grafito')], cursor: null })
  context.value.searchWorks = search
  render(<MemoryRouter initialEntries={['/descubrir?q=inspiración%20para%20hacer%20un%20dibujo%20realista&estilo=Realismo&tecnica=Grafito&contenido=IMAGEN']}><DiscoverPage /></MemoryRouter>)

  await advanceSearch()
  expect(screen.getByRole('link', { name: 'Retrato a lápiz' })).toHaveAttribute('href', '/obra/remote')
  expect(search).toHaveBeenCalledWith(expect.objectContaining({ query: 'inspiración para hacer un dibujo realista', style: 'Realismo', technique: 'Grafito', contentType: 'IMAGEN' }), expect.any(AbortSignal))
  fireEvent.click(screen.getByRole('button', { name: 'Cargar más resultados' }))
  await advanceSearch(1)
  expect(screen.getByRole('link', { name: 'Estudio de grafito' })).toBeVisible()
  expect(screen.getAllByRole('link', { name: 'Retrato a lápiz' })).toHaveLength(1)
  expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: '1' }), expect.any(AbortSignal))
})

it('descarta una respuesta tardía y diferencia un error de una búsqueda sin resultados', async () => {
  vi.useFakeTimers()
  let oldSignal: AbortSignal | undefined
  let finishOld: (value: unknown) => void = () => undefined
  const search = vi.fn()
    .mockImplementationOnce((_filters, signal: AbortSignal) => { oldSignal = signal; return new Promise(resolve => { finishOld = resolve }) })
    .mockRejectedValueOnce(new Error('Sin conexión'))
    .mockResolvedValueOnce({ items: [], cursor: null })
  context.value.searchWorks = search
  render(<MemoryRouter initialEntries={['/descubrir?q=retrato']}><DiscoverPage /></MemoryRouter>)
  await advanceSearch()
  expect(search).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'acuarela' } })
  await advanceSearch()
  expect(screen.getByRole('alert')).toHaveTextContent('No pudimos completar la búsqueda')
  expect(oldSignal?.aborted).toBe(true)
  await act(async () => finishOld({ items: [remoteWork('late', 'Resultado anterior')], cursor: null }))
  expect(screen.queryByText('Resultado anterior')).not.toBeInTheDocument()
  expect(screen.queryByText('Todavía no encontramos coincidencias')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar búsqueda' }))
  await advanceSearch(1)
  expect(screen.getByText('Todavía no encontramos coincidencias')).toBeVisible()
})

it('busca canciones, consulta una letra y permite buscar sonidos', async () => {
  music.search.mockResolvedValueOnce([{ id: 1, titulo: 'Yellow', artista: 'Coldplay' }])
    .mockResolvedValueOnce([{ id: 2, titulo: 'Lluvia', licencia: 'CC0' }])
  music.resolve.mockResolvedValue({ letraCompleta: 'Letra de prueba' })
  render(<MemoryRouter initialEntries={['/descubrir?tipo=musica&q=yellow']}><DiscoverPage /></MemoryRouter>)
  await userEvent.click(await screen.findByRole('button', { name: 'Ver letra de Yellow' }))
  expect(await screen.findByText('Letra de prueba')).toBeVisible()
  expect(music.resolve).toHaveBeenCalledWith({ tipoRecurso: 'cancion', titulo: 'Yellow', artista: 'Coldplay' }, expect.any(AbortSignal))
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de recurso musical' }), 'sample')
  expect(await screen.findByText('Lluvia')).toBeVisible()
  expect(music.search).toHaveBeenLastCalledWith('sample', 'yellow', expect.any(AbortSignal))
})

it('filtra sonidos por licencia CC0 o CC BY sin mostrar CC BY-SA', async () => {
  music.search.mockResolvedValueOnce([
    { id: 2, titulo: 'Lluvia', licencia: 'https://creativecommons.org/publicdomain/zero/1.0/' },
    { id: 3, titulo: 'Viento', licencia: 'https://creativecommons.org/licenses/by/4.0/' },
    { id: 4, titulo: 'Trueno', licencia: 'CC BY-SA 4.0' },
  ])
  render(<MemoryRouter initialEntries={['/descubrir?tipo=musica&recurso=sample&q=sonido']}><DiscoverPage /></MemoryRouter>)
  expect(await screen.findByText('Viento')).toBeVisible()
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Licencia de los sonidos' }), 'cc-by')
  expect(screen.getByText('Viento')).toBeVisible()
  expect(screen.queryByText('Lluvia')).not.toBeInTheDocument()
  expect(screen.queryByText('Trueno')).not.toBeInTheDocument()
})

it('combina mapa con búsqueda, disciplina y técnica, y conserva el orden al activarlo y desactivarlo', async () => {
  render(<MemoryRouter initialEntries={['/descubrir?q=Naturaleza&disciplina=Fotografía&tecnica=Digital&orden=titulo']}><DiscoverPage /><Location /></MemoryRouter>)
  await userEvent.click(screen.getByRole('checkbox', { name: 'Mapa' }))

  expect(screen.getByRole('searchbox')).toHaveValue('Naturaleza')
  expect(screen.getByRole('combobox', { name: 'Disciplina' })).toHaveValue('Fotografía')
  expect(screen.getByRole('combobox', { name: 'Técnica' })).toHaveValue('Digital')
  expect(screen.getByRole('combobox', { name: 'Orden' })).toHaveValue('titulo')
  const map = within(screen.getByLabelText('Mapa de resultados'))
  expect(map.getByText('Bosque')).toBeVisible()
  expect(map.queryByText('Pintura')).not.toBeInTheDocument()
  expect(map.queryByText('Analógica')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('checkbox', { name: 'Mapa' }))
  expect(screen.queryByLabelText('Mapa de resultados')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Dirección')).toHaveTextContent('q=Naturaleza')
  expect(within(screen.getByRole('list', { name: 'Resultados' })).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Bosque', 'Cómo fotografiar'])
})

it('pregunta una vez por sesión si usar la ubicación guardada y respeta la elección', async () => {
  preferenceState.value = 'ACTIVADA'
  render(<MemoryRouter initialEntries={['/descubrir?mapa=1']}><DiscoverPage /></MemoryRouter>)
  const dialog = within(await screen.findByRole('dialog', { name: '¿Usar tu ubicación en esta sesión?' }))
  await userEvent.click(dialog.getByRole('button', { name: 'No usar mi ubicación' }))
  expect(screen.queryByRole('dialog', { name: '¿Usar tu ubicación en esta sesión?' })).not.toBeInTheDocument()
  expect(window.sessionStorage.getItem('trama.ubicacionSesion')).toBe('DESACTIVADA')
  expect(screen.getByLabelText('Mapa de resultados')).toBeInTheDocument()
})

it('no vuelve a preguntar la ubicación dentro de la misma sesión', async () => {
  preferenceState.value = 'ACTIVADA'
  window.sessionStorage.setItem('trama.ubicacionSesion', 'ACTIVADA')
  render(<MemoryRouter initialEntries={['/descubrir?mapa=1']}><DiscoverPage /></MemoryRouter>)
  expect(await screen.findByLabelText('Mapa de resultados')).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: '¿Usar tu ubicación en esta sesión?' })).not.toBeInTheDocument()
})

it('permite abrir el mapa sin texto y combinarlo con la pestaña Tutoriales', async () => {
  render(<MemoryRouter initialEntries={['/descubrir?mapa=1&tipo=tutoriales&disciplina=Fotografía&tecnica=Digital']}><DiscoverPage /></MemoryRouter>)
  const map = within(await screen.findByLabelText('Mapa de resultados'))
  expect(map.getByText('Cómo fotografiar')).toBeVisible()
  expect(map.queryByText('Bosque')).not.toBeInTheDocument()
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Técnica' }), 'Analógica')
  await waitFor(() => expect(map.queryByText('Cómo fotografiar')).not.toBeInTheDocument())
  await userEvent.click(screen.getByRole('tab', { name: 'Obras' }))
  expect(screen.getByRole('combobox', { name: 'Disciplina' })).toHaveValue('Fotografía')
  expect(screen.getByRole('combobox', { name: 'Técnica' })).toHaveValue('Analógica')
  expect(map.getByText('Analógica')).toBeVisible()
})

it('mantiene el mapa al aplicar los filtros desde el diálogo móvil', async () => {
  render(<MemoryRouter initialEntries={['/descubrir?mapa=1']}><DiscoverPage /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'Filtros' }))
  const dialog = within(screen.getByRole('dialog', { name: 'Filtros' }))
  await userEvent.selectOptions(dialog.getByRole('combobox', { name: 'Disciplina' }), 'Fotografía')
  await userEvent.selectOptions(dialog.getByRole('combobox', { name: 'Técnica' }), 'Digital')
  await userEvent.click(dialog.getByRole('button', { name: 'Mostrar resultados' }))
  expect(screen.getByRole('checkbox', { name: 'Mapa' })).toBeChecked()
  const map = within(screen.getByLabelText('Mapa de resultados'))
  expect(map.getByText('Bosque')).toBeVisible()
  expect(map.queryByText('Pintura')).not.toBeInTheDocument()
  expect(map.queryByText('Analógica')).not.toBeInTheDocument()
})
