import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlacesExplorer } from './PlacesExplorer'

vi.mock('./MapView', () => ({
  MapView: (props: {
    items: { publicacion: { id: string } }[]
    onSelect: (id: string) => void
    onViewChange: (bounds: { sur: number; norte: number; oeste: number; este: number }) => void
    onUnavailable: () => void
  }) => <div data-testid="map">
    <button type="button" onClick={() => props.onViewChange({ sur: 1, norte: 2, oeste: 3, este: 4 })}>mover mapa</button>
    <button type="button" onClick={props.onUnavailable}>fallan las teselas</button>
    {props.items.map(item => <button key={item.publicacion.id} type="button" onClick={() => props.onSelect(item.publicacion.id)}>marcador {item.publicacion.id}</button>)}
  </div>,
}))

const publication = (id: string, extra: Record<string, unknown> = {}) => ({
  publicacion: { id, usuarioId: 'u1', contenido: `Obra ${id}`, tipoContenido: 'IMAGEN', fotoUrl: null, estado: 'ACTIVA', ubicacion: { latitud: -34.6, longitud: -58.4 }, ...extra },
})
const granted = { enabled: true, reason: 'ok' } as const
const denied = { enabled: false, reason: 'permiso-denegado' } as const
const position = { latitud: -34.61, longitud: -58.39 }

let api: { query: ReturnType<typeof vi.fn>; detail: ReturnType<typeof vi.fn> }

beforeEach(() => {
  api = { query: vi.fn().mockResolvedValue({ items: [], nextCursor: null }), detail: vi.fn() }
})

function open(access: typeof granted | typeof denied = denied) {
  return render(<MemoryRouter><PlacesExplorer api={api as never} access={access} getPosition={vi.fn().mockResolvedValue(position)} /></MemoryRouter>)
}

describe('mapa y lista de lugares (FR-005/006/013/027)', () => {
  it('sin ubicación abre la vista mundial por zona, sin coordenadas del usuario', async () => {
    open()

    await waitFor(() => expect(api.query).toHaveBeenCalledTimes(1))
    const { criterio } = api.query.mock.calls[0]![0]
    expect(criterio).toMatchObject({ modo: 'ZONA', sur: -90, norte: 90, oeste: -180, este: 180 })
    expect(criterio.centro).toBeUndefined()
  })

  it('mantiene una entrada por publicación aunque compartan ubicación', async () => {
    api.query.mockResolvedValue({ items: [publication('a'), publication('b')], nextCursor: null })
    open()

    const list = await screen.findByRole('list', { name: 'Publicaciones con lugar' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  })

  it('al elegir una entrada muestra el detalle de esa publicación', async () => {
    api.query.mockResolvedValue({ items: [publication('a'), publication('b')], nextCursor: null })
    api.detail.mockResolvedValue({ id: 'b', contenido: 'Detalle de b', ubicacion: { latitud: -34.6, longitud: -58.4 } })
    open()

    await userEvent.click(await screen.findByRole('button', { name: /Obra b/ }))

    expect(api.detail).toHaveBeenCalledWith('b')
    expect(await screen.findByText('Detalle de b')).toBeVisible()
  })

  it('informa que no hay lugares cuando no hay publicaciones elegibles', async () => {
    open()

    expect(await screen.findByText('No hay lugares de inspiración para mostrar.')).toBeVisible()
  })

  it('distingue un mapa no disponible de no tener resultados y conserva la lista', async () => {
    api.query.mockResolvedValue({ items: [publication('a')], nextCursor: null })
    open()
    await screen.findByRole('button', { name: /Obra a/ })

    await userEvent.click(screen.getByRole('button', { name: 'fallan las teselas' }))

    expect(screen.getByRole('status', { name: 'Estado del mapa' })).toHaveTextContent('El mapa no está disponible')
    expect(screen.getByRole('button', { name: /Obra a/ })).toBeVisible()
    expect(screen.queryByText('No hay lugares de inspiración para mostrar.')).not.toBeInTheDocument()
  })

  it('sin filtro de distancia, mover el mapa actualiza la lista con la zona visible', async () => {
    open()
    await waitFor(() => expect(api.query).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button', { name: 'mover mapa' }))

    await waitFor(() => expect(api.query).toHaveBeenCalledTimes(2))
    expect(api.query.mock.calls[1]![0].criterio).toMatchObject({ modo: 'ZONA', sur: 1, norte: 2, oeste: 3, este: 4 })
  })

  it('con permiso y filtro activo consulta por radio y mover el mapa no cambia la lista', async () => {
    open(granted)
    await waitFor(() => expect(api.query).toHaveBeenCalled())

    fireEvent.change(screen.getByRole('slider', { name: 'Distancia máxima' }), { target: { value: '30' } })
    await waitFor(() => expect(api.query.mock.calls.at(-1)![0].criterio).toMatchObject({ modo: 'RADIO', centro: position, radioKm: 30 }))
    const calls = api.query.mock.calls.length

    await userEvent.click(screen.getByRole('button', { name: 'mover mapa' }))

    expect(api.query).toHaveBeenCalledTimes(calls)
  })

  it('con permiso denegado deshabilita la distancia y no envía coordenadas', async () => {
    open(denied)
    await waitFor(() => expect(api.query).toHaveBeenCalled())

    expect(screen.getByRole('slider', { name: 'Distancia máxima' })).toBeDisabled()
    expect(api.query.mock.calls.every(call => call[0].criterio.modo === 'ZONA')).toBe(true)
  })

  it('pagina con el cursor y no repite publicaciones ya mostradas', async () => {
    api.query
      .mockResolvedValueOnce({ items: [publication('a'), publication('b')], nextCursor: 'c1' })
      .mockResolvedValueOnce({ items: [publication('b'), publication('c')], nextCursor: null })
    open()
    await screen.findByRole('button', { name: /Obra a/ })

    await userEvent.click(screen.getByRole('button', { name: 'Ver más lugares' }))

    await screen.findByRole('button', { name: /Obra c/ })
    expect(api.query.mock.calls[1]![0].cursor).toBe('c1')
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })
})
