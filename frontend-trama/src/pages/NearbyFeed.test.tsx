import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { placesApi } from '../data/api'
import type { Post } from '../data/model'
import { cityWorks, nearbyWorks } from '../data/nearbyFeed'
import { NearbyFeed } from './NearbyFeed'

vi.mock('../data/nearbyFeed', () => ({ NEARBY_RADIUS_KM: 5, cityWorks: vi.fn(), nearbyWorks: vi.fn() }))
vi.mock('../components/FeedMap', () => ({ FeedMap: () => <div role="application" aria-label="Mapa de publicaciones" /> }))
vi.mock('../components/PostCard', () => ({
  PostGrid: ({ posts }: { posts: Post[] }) => <ul>{posts.map(post => <li key={post.id}>{post.title}</li>)}</ul>,
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function setup(permission: 'granted' | 'denied') {
  const position = vi.fn((ok: PositionCallback) => ok({ coords: { latitude: -34.6, longitude: -58.38 } } as GeolocationPosition))
  vi.stubGlobal('navigator', {
    ...navigator,
    geolocation: { getCurrentPosition: position },
    permissions: { query: async () => ({ state: permission }) },
  })
  vi.spyOn(placesApi.preference, 'get').mockResolvedValue('PENDIENTE')
  const save = vi.spyOn(placesApi.preference, 'set').mockResolvedValue('ACTIVADA')
  const post = (id: string, title: string) => ({ id, title }) as Post
  render(<MemoryRouter><NearbyFeed posts={[post('near', 'Cerca del centro'), post('city', 'Desde otro barrio')]} /></MemoryRouter>)
  return { position, save }
}

it('consulta solo al activar y muestra primero las cercanas, sin repetirlas en la ciudad', async () => {
  const { position, save } = setup('granted')
  vi.mocked(nearbyWorks).mockResolvedValue(['near', 'blocked'])
  vi.mocked(cityWorks).mockResolvedValue({ name: 'Rosario', ids: ['near', 'city', 'blocked'] })
  const button = await screen.findByRole('button', { name: 'Activar y usar mi ubicación' })
  await waitFor(() => expect(button).toBeEnabled())
  expect(position).not.toHaveBeenCalled()

  await userEvent.click(button)

  const nearby = (await screen.findByRole('heading', { name: 'A menos de 5 km' })).closest('section')!
  const city = screen.getByRole('heading', { name: 'En Rosario' }).closest('section')!
  expect(save).toHaveBeenCalledWith('ACTIVADA')
  expect(position).toHaveBeenCalledOnce()
  expect(nearby.nextElementSibling).toBe(city)
  expect(within(nearby).getByText('Cerca del centro')).toBeInTheDocument()
  expect(within(city).getByText('Desde otro barrio')).toBeInTheDocument()
  expect(within(city).queryByText('Cerca del centro')).not.toBeInTheDocument()
})

it('indica cómo recuperar el acceso si el navegador lo denegó', async () => {
  const { position, save } = setup('denied')
  expect(await screen.findByRole('heading', { name: 'No podemos acceder a tu ubicación' })).toBeInTheDocument()
  expect(screen.getByRole('application', { name: 'Mapa de publicaciones' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Configuración de ubicación' })).toHaveAttribute('href', '/ubicacion/configuracion?desde=inicio')
  expect(position).not.toHaveBeenCalled()
  expect(save).not.toHaveBeenCalled()
})
