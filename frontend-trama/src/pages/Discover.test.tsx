import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import type { MapPublication } from '../data/api'
import type { DemoState, Post } from '../data/model'
import { DiscoverPage } from './Discover'

const { context } = vi.hoisted(() => ({ context: { value: {} as Record<string, unknown> } }))
vi.mock('../context/DemoContext', () => ({ useDemo: () => context.value }))
vi.mock('../lib/useDevicePermission', () => ({ useDevicePermission: () => ['denied'] }))
vi.mock('../data/api', () => ({
  placesApi: {
    catalog: async () => [{ codigo: 'fotografia', nombre: 'Fotografía', tecnicas: [{ codigo: 'digital', nombre: 'Digital' }, { codigo: 'analogica', nombre: 'Analógica' }] }],
    preference: { get: async () => 'DESACTIVADA' },
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
