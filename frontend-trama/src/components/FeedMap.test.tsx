import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Post } from '../data/model'
import { mapWorks } from '../data/nearbyFeed'
import type { Zone } from '../data/places'
import { FeedMap } from './FeedMap'
import type { MapItem } from './MapView'

const buenosAires = { sur: -35, norte: -34, oeste: -59, este: -57 }
const rosario = { sur: -33.2, norte: -32.8, oeste: -61, este: -60 }
const row = (id: string) => ({ publicacion: { id } })
const posts = [{ id: 'centro' }, { id: 'rosario' }] as Post[]
vi.mock('../data/nearbyFeed', () => ({ mapWorks: vi.fn(), NEARBY_RADIUS_KM: 5 }))
vi.mock('./MapView', () => ({
  MapView: ({ items, onViewChange, onSelect }: {
    items: MapItem[]; onViewChange: (zone: Zone) => void; onSelect: (id: string) => void
  }) => <div>
    <button onClick={() => onViewChange(buenosAires)}>Mostrar Buenos Aires</button>
    <button onClick={() => onViewChange(rosario)}>Mostrar Rosario</button>
    {items.map(({ publicacion }) => <button key={publicacion.id} onClick={() => onSelect(publicacion.id)}>{publicacion.id}</button>)}
  </div>,
}))

function Path() {
  const { pathname, state } = useLocation()
  return <p>{pathname} desde {state?.from}</p>
}

beforeEach(() => vi.mocked(mapWorks).mockReset())

it('puede cambiar de zona sin ubicación del dispositivo y abrir un pin de esa zona', async () => {
  vi.mocked(mapWorks).mockResolvedValueOnce([row('centro')]).mockResolvedValueOnce([row('rosario'), row('no-visible')])
  render(<MemoryRouter initialEntries={['/inicio?vista=mapa']}><FeedMap posts={posts} /><Path /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'Mostrar Buenos Aires' }))
  expect(await screen.findByRole('button', { name: 'centro' })).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Mostrar Rosario' }))
  await userEvent.click(await screen.findByRole('button', { name: 'rosario' }))
  expect(screen.getByText('/obra/rosario desde /inicio?vista=mapa')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'centro' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'no-visible' })).not.toBeInTheDocument()
  expect(mapWorks).toHaveBeenNthCalledWith(2, rosario, expect.any(AbortSignal))
})

it('cancela una consulta anterior cuando se desplaza el mapa', async () => {
  let respond: (items: ReturnType<typeof row>[]) => void = () => {}
  vi.mocked(mapWorks)
    .mockImplementationOnce(() => new Promise(resolve => { respond = resolve }))
    .mockResolvedValueOnce([row('rosario')])
  render(<MemoryRouter><FeedMap posts={posts} /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'Mostrar Buenos Aires' }))
  await waitFor(() => expect(mapWorks).toHaveBeenCalledOnce())
  const signal = vi.mocked(mapWorks).mock.calls[0]![1]
  await userEvent.click(screen.getByRole('button', { name: 'Mostrar Rosario' }))
  expect(signal.aborted).toBe(true)
  expect(await screen.findByRole('button', { name: 'rosario' })).toBeVisible()
  await act(async () => respond([row('centro')]))
  expect(screen.queryByRole('button', { name: 'centro' })).not.toBeInTheDocument()
})
