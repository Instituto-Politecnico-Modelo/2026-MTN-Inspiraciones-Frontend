import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppRoutes } from './App'
import { DemoRepository } from './data/repository'

let repository: DemoRepository
let router: ReturnType<typeof createMemoryRouter> | undefined

beforeEach(() => {
  sessionStorage.clear()
  repository = new DemoRepository(`trama-routes-${crypto.randomUUID()}`)
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

function openRoute(path: string, profile?: string) {
  if (profile) sessionStorage.setItem('trama-demo-profile', profile)
  router = createMemoryRouter(createAppRoutes(repository), { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

vi.setConfig({ testTimeout: 20000 })

describe('integracion de rutas', () => {
  it('muestra artistas remotos al abrir el directorio sin escribir una búsqueda', async () => {
    const state = await repository.load()
    const remote = { ...state.users.find(user => user.id === 'mora')!, id: 'remote-user', name: 'Artista Remota', handle: 'remota' }
    const searchUsers = vi.fn().mockResolvedValue([remote])
    Object.assign(repository, { searchUsers })
    openRoute('/descubrir?tipo=artistas', 'mora')

    expect(await screen.findByRole('link', { name: /Artista Remota/ })).toHaveAttribute('href', '/remota')
    expect(searchUsers).toHaveBeenCalledWith('')
  })

  it('abre un perfil remoto por nombre de usuario desde una sesión nueva', async () => {
    const state = await repository.load()
    const remote = { ...state.users.find(user => user.id === 'mora')!, id: 'remote-user', name: 'Artista Remota', handle: 'remota' }
    const getProfile = vi.fn().mockResolvedValue(remote)
    Object.assign(repository, { getProfile })
    openRoute('/remota')

    expect(await screen.findByRole('heading', { name: 'Artista Remota', level: 1 })).toBeVisible()
    expect(getProfile).toHaveBeenCalledWith({ username: 'remota' })
    expect(screen.getByRole('link', { name: 'Ingresar para ver las obras' })).toHaveAttribute('href', '/ingresar?volver=%2Fremota')
    expect(screen.queryByText('Todavía no hay obras para mostrar')).not.toBeInTheDocument()
  })

  it('descubrir artistas excluye administradores recibidos desde la búsqueda', async () => {
    const state = await repository.load()
    const artist = { ...state.users.find(user => user.id === 'mora')!, id: 'remote-artist', name: 'Artista Remota', handle: 'artista.remota' }
    const admin = { ...state.users.find(user => user.role === 'admin')!, id: 'remote-admin', name: 'Administracion Remota', handle: 'equipo.remoto' }
    const cached = { ...artist, id: 'cached-admin', name: 'Administrador sin rol precargado', handle: 'equipo.precargado' }
    vi.spyOn(repository, 'load').mockResolvedValue({ ...state, users: [...state.users, cached] })
    Object.assign(repository, { searchUsers: vi.fn().mockResolvedValue([artist, admin]) })
    openRoute('/descubrir?tipo=artistas', 'mora')

    expect(await screen.findByRole('link', { name: /Artista Remota/ })).toBeVisible()
    expect(screen.queryByRole('link', { name: /Administracion Remota/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Administrador sin rol precargado/ })).not.toBeInTheDocument()
  })

  it('busca artistas remotos sin publicaciones y permite abrir su perfil', async () => {
    const state = await repository.load()
    const remote = { ...state.users.find(user => user.id === 'mora')!, id: 'remote-user', name: 'Artista Remota', handle: 'remota' }
    const searchUsers = vi.fn().mockResolvedValue([remote])
    Object.assign(repository, { searchUsers })
    openRoute('/descubrir?tipo=artistas&q=remota', 'mora')

    const link = await screen.findByRole('link', { name: /Artista Remota/ })
    expect(searchUsers).toHaveBeenCalledWith('remota')
    await userEvent.click(link)
    expect(await screen.findByRole('heading', { name: 'Artista Remota', level: 1 })).toBeVisible()
  })

  it('informa cuando falla la búsqueda remota de artistas', async () => {
    Object.assign(repository, { searchUsers: vi.fn().mockRejectedValue(new Error('Servidor de búsqueda no disponible.')) })
    openRoute('/descubrir?tipo=artistas&q=remota', 'mora')

    expect(await screen.findByText('Servidor de búsqueda no disponible.')).toBeVisible()
  })

  it('abre Inicio desde la raiz con los datos locales', async () => {
    const current = openRoute('/')
    expect(await screen.findByRole('heading', { name: 'Inicio' }, { timeout: 8000 })).toBeVisible()
    expect(current.state.location.pathname).toBe('/inicio')
    expect(screen.getByRole('tab', { name: 'Para vos' })).toHaveAttribute('aria-selected', 'true')
  })

  it('protege Publicar y conserva el destino solicitado', async () => {
    const destination = '/publicar?desafio=consigna-local'
    const current = openRoute(destination)
    expect(await screen.findByRole('heading', { name: 'Ingresar' }, { timeout: 8000 })).toBeVisible()
    expect(current.state.location.pathname).toBe('/ingresar')
    expect(new URLSearchParams(current.state.location.search).get('volver')).toBe(destination)
  })

  it('monta el editor protegido dentro de un data router', async () => {
    openRoute('/perfil/editar', 'mora')
    expect(await screen.findByRole('heading', { name: 'Editar perfil' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })

  it('rechaza el acceso directo de un artista a administracion', async () => {
    openRoute('/admin/usuarios', 'mora')
    expect(await screen.findByRole('heading', { name: /Solo administraci.n/ })).toBeVisible()
    expect(screen.queryByRole('navigation', { name: /Administraci.n m.vil/ })).not.toBeInTheDocument()
  })

  it.each([
    { profile: undefined, visible: false },
    { profile: 'mora', visible: false },
    { profile: 'admin', visible: true },
  ])('navegacion: acceso administrativo con perfil $profile', async ({ profile, visible }) => {
    openRoute('/inicio', profile)
    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeVisible()
    const link = screen.queryByRole('link', { name: /^Administraci.n$/ })
    if (visible) {
      expect(link).toBeVisible()
      expect(link).toHaveAttribute('href', '/admin/resumen')
    } else {
      expect(link).not.toBeInTheDocument()
    }
  })

  it('ofrece una salida para una ruta desconocida', async () => {
    openRoute('/ruta/que-no-existe')
    expect(await screen.findByRole('heading', { name: /No encontramos esa p.gina/ })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Ir a Inicio' })).toHaveAttribute('href', '/inicio')
  })

  it('audio: recupera una fuente fallida antes de reintentar la reproduccion', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    openRoute('/obra/obra-4')
    const audio = await screen.findByLabelText<HTMLAudioElement>('Audio: Luz de tarde')
    const failure = vi.fn<() => MediaError | null>().mockReturnValue({
      code: 4, message: 'Fuente temporalmente inaccesible',
      MEDIA_ERR_ABORTED: 1, MEDIA_ERR_NETWORK: 2, MEDIA_ERR_DECODE: 3, MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
    })
    Object.defineProperty(audio, 'error', { configurable: true, get: failure })
    const reload = vi.spyOn(audio, 'load').mockImplementation(() => { failure.mockReturnValue(null) })
    vi.spyOn(audio, 'play').mockImplementation(() => {
      if (audio.error) return Promise.reject(new DOMException('Fuente no disponible', 'NotSupportedError'))
      fireEvent.play(audio)
      return Promise.resolve()
    })
    fireEvent.error(audio)
    expect(screen.getByRole('alert')).toHaveTextContent('Este audio no se puede reproducir ahora.')
    await user.click(screen.getByRole('button', { name: 'Reproducir Luz de tarde' }))
    expect(await screen.findByRole('button', { name: 'Pausar Luz de tarde' })).toBeEnabled()
    expect(reload).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    { path: '/descubrir', postId: 'obra-3', actorId: 'mora', label: /T.cnica/ },
  ])('descubrir: no duplica la opcion general con tecnicas vacias en $path', async ({ path, postId, actorId, label }) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const state = await repository.load()
    const post = state.posts.find(candidate => candidate.id === postId)
    if (!post) throw new Error('Falta la obra de ejemplo para la prueba.')
    const { title, description, alt, discipline, license } = post
    await repository.execute(actorId, { type: 'update-post', postId, changes: { title, description, alt, discipline, license, technique: '' } })
    openRoute(path)
    const filter = await screen.findByRole('combobox', { name: label })
    expect(filter.querySelectorAll('option[value=""]')).toHaveLength(1)
    expect(within(filter).queryByRole('option', { name: '' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: title })).toBeVisible()
  })

  it('admin: permite cancelar y confirmar una suspension sin afectar su propia cuenta', async () => {
    const user = userEvent.setup()
    openRoute('/admin/usuarios', 'admin')
    const suspend = await screen.findByRole('button', { name: 'Suspender a Mora Vidal' })
    expect(screen.getByRole('button', { name: 'Suspender a Equipo Trama' })).toBeDisabled()
    await user.click(suspend)
    let dialog = await screen.findByRole('dialog', { name: 'Suspender este perfil' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect((await repository.load()).users.find(member => member.id === 'mora')?.status).toBe('active')
    await user.click(suspend)
    dialog = await screen.findByRole('dialog', { name: 'Suspender este perfil' })
    await user.type(within(dialog).getByLabelText(/Motivo de la decisi.n/), 'Revision de la cuenta local.')
    await user.click(within(dialog).getByRole('button', { name: 'Suspender perfil' }))
    await waitFor(async () => expect((await repository.load()).users.find(member => member.id === 'mora')?.status).toBe('suspended'))
    expect(await screen.findByRole('button', { name: 'Reactivar a Mora Vidal' })).toBeVisible()
  })

  it('descubrir: cancelar los filtros conserva la busqueda y aplicar actualiza la URL', async () => {
    const user = userEvent.setup()
    const current = openRoute('/descubrir?q=Corriente&disciplina=Pintura')
    expect(await screen.findByRole('heading', { name: 'Corriente dual' })).toBeVisible()
    for (const name of ['Obras', 'Artistas']) {
      expect(screen.getByRole('tab', { name })).toBeVisible()
    }
    await user.click(screen.getByRole('button', { name: 'Filtros (1)' }))
    let dialog = await screen.findByRole('dialog', { name: 'Filtros' })
    await user.selectOptions(within(dialog).getByLabelText('Disciplina'), 'Cerámica')
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar diálogo' }))
    expect(new URLSearchParams(current.state.location.search).get('disciplina')).toBe('Pintura')
    await user.click(screen.getByRole('button', { name: 'Filtros (1)' }))
    dialog = await screen.findByRole('dialog', { name: 'Filtros' })
    expect(within(dialog).getByLabelText('Disciplina')).toHaveValue('Pintura')
    await user.click(within(dialog).getByRole('button', { name: 'Limpiar' }))
    await user.click(within(dialog).getByRole('button', { name: 'Mostrar resultados' }))
    const params = new URLSearchParams(current.state.location.search)
    expect(params.get('disciplina')).toBeNull()
    expect(params.get('q')).toBe('Corriente')
    expect(screen.getByRole('heading', { name: 'Corriente dual' })).toBeVisible()
  })

  it('descubrir: volver de una obra conserva los parametros de busqueda', async () => {
    const user = userEvent.setup()
    const current = openRoute('/descubrir?q=Corriente&disciplina=Pintura')
    await user.click(await screen.findByRole('heading', { name: 'Corriente dual' }))
    expect(await screen.findByRole('heading', { name: 'Corriente dual', level: 1 })).toBeVisible()
    await user.click(screen.getByRole('link', { name: /Volver/ }))
    expect(current.state.location.pathname).toBe('/descubrir')
    expect(new URLSearchParams(current.state.location.search).get('q')).toBe('Corriente')
    expect(new URLSearchParams(current.state.location.search).get('disciplina')).toBe('Pintura')
  })

  it('perfil: usa el singular cuando una carpeta contiene una referencia', async () => {
    openRoute('/perfil?vista=guardados', 'mora')
    expect(await screen.findByText('1 referencia guardada')).toBeVisible()
    expect(screen.getByText('2 referencias guardadas')).toBeVisible()
  })

  it('perfil: muestra cantidades en singular para un seguidor', async () => {
    openRoute('/perfil', 'mora')
    const heading = await screen.findByRole('heading', { name: 'Mora Vidal' })
    const counts = heading.closest('.profile-heading')?.querySelector('.profile-counts')
    expect(counts?.children[0]).toHaveTextContent(/^3 obras$/)
    expect(counts?.children[1]).toHaveTextContent(/^1 seguidor$/)
    expect(counts?.children[2]).toHaveTextContent(/^2 seguidos$/)
  })

  it('redirige los enlaces anteriores al nombre de usuario conservando la pestaña', async () => {
    const current = openRoute('/perfil/mora?vista=guardados', 'mora')
    await screen.findByRole('heading', { name: 'Mora Vidal', level: 1 })
    await waitFor(() => expect(current.state.location.pathname).toBe('/moravidal'))
    expect(current.state.location.search).toBe('?vista=guardados')
  })

  it('perfil: abre sus seguidos y permite visitar un perfil desde la lista', async () => {
    const user = userEvent.setup()
    const current = openRoute('/perfil', 'mora')
    await user.click(await screen.findByRole('button', { name: '2 seguidos' }))
    const dialog = screen.getByRole('dialog', { name: 'Seguidos' })
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(2)
    const state = await repository.load()
    for (const id of ['lara', 'mateo']) {
      const person = state.users.find(candidate => candidate.id === id)!
      const link = within(dialog).getByRole('link', { name: `${person.name} @${person.handle}` })
      expect(link).toHaveAttribute('href', `/${person.handle}`)
    }
    expect(within(dialog).queryByRole('link', { name: /Julia Pardo/ })).not.toBeInTheDocument()
    const lara = state.users.find(candidate => candidate.id === 'lara')!
    await user.click(within(dialog).getByRole('link', { name: `${lara.name} @${lara.handle}` }))
    expect(await screen.findByRole('heading', { name: lara.name, level: 1 })).toBeVisible()
    expect(current.state.location.pathname).toBe(`/${lara.handle}`)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('perfil: abre sus seguidores con teclado y devuelve el foco al cerrar', async () => {
    const user = userEvent.setup()
    openRoute('/perfil', 'mora')
    const trigger = await screen.findByRole('button', { name: '1 seguidor' })
    trigger.focus()
    await user.keyboard('{Enter}')
    const dialog = screen.getByRole('dialog', { name: 'Seguidores' })
    const state = await repository.load()
    const follower = state.users.find(candidate => candidate.id === 'julia')!
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(1)
    expect(within(dialog).getByRole('link', { name: `${follower.name} @${follower.handle}` })).toHaveAttribute('href', `/${follower.handle}`)
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar diálogo' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    await user.click(trigger)
    fireEvent(screen.getByRole('dialog', { name: 'Seguidores' }), new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it.each([
    { button: '0 seguidores', title: 'Seguidores', empty: 'Todavía no tenés seguidores' },
    { button: '0 seguidos', title: 'Seguidos', empty: 'Todavía no seguís a nadie' },
  ])('perfil: muestra un estado vacio al abrir $title', async ({ button, title, empty }) => {
    const user = userEvent.setup()
    openRoute('/perfil', 'nico')
    await user.click(await screen.findByRole('button', { name: button }))
    const dialog = screen.getByRole('dialog', { name: title })
    expect(within(dialog).getByRole('heading', { name: empty })).toBeVisible()
    expect(within(dialog).queryByRole('list')).not.toBeInTheDocument()
  })

  it('perfil: muestra los seguidores de otro artista sin confundirlos con los propios', async () => {
    const user = userEvent.setup()
    openRoute('/perfil/lara', 'mora')
    await user.click(await screen.findByRole('button', { name: '1 seguidor' }))
    const dialog = screen.getByRole('dialog', { name: 'Seguidores' })
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(1)
    expect(within(dialog).getByRole('link', { name: /Mora Vidal @/ })).toHaveAttribute('href', '/moravidal')
  })

  it('admin: muestra cantidades en singular para una apelacion pendiente', async () => {
    openRoute('/admin/resumen', 'admin')
    expect(await screen.findByRole('link', { name: /^1 apelaci.n pendiente$/ })).toBeVisible()
  })

  it('admin: aceptar un reporte oculta la obra y conserva la resolucion', async () => {
    const user = userEvent.setup()
    openRoute('/admin/moderacion/reportes/reporte-1', 'admin')
    await user.click(await screen.findByRole('button', { name: 'Aceptar reporte' }))
    const dialog = await screen.findByRole('dialog', { name: 'Aceptar este reporte' })
    await user.type(within(dialog).getByLabelText(/Motivo de la decisi.n/), 'El credito requiere una revision.')
    await user.click(within(dialog).getByRole('button', { name: 'Aceptar reporte' }))
    await waitFor(async () => {
      const state = await repository.load()
      expect(state.reports.find(report => report.id === 'reporte-1')?.status).toBe('accepted')
      expect(state.posts.find(post => post.id === 'obra-10')?.status).toBe('hidden')
    })
    expect(await screen.findByRole('heading', { name: /Resoluci.n/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Aceptar reporte' })).not.toBeInTheDocument()
  })

  it('admin: aprobar una propuesta exige publicar el desafio en un paso separado', async () => {
    const user = userEvent.setup()
    const initial = await repository.load()
    openRoute('/admin/solicitudes/solicitud-1', 'admin')
    await user.click(await screen.findByRole('button', { name: 'Aprobar propuesta' }))
    const dialog = await screen.findByRole('dialog', { name: 'Aprobar esta propuesta' })
    await user.type(within(dialog).getByLabelText(/Motivo de la decisi.n/), 'Aprobada para definir fechas.')
    await user.click(within(dialog).getByRole('button', { name: 'Aprobar propuesta' }))
    await waitFor(async () => expect((await repository.load()).requests.find(request => request.id === 'solicitud-1')?.status).toBe('approved'))
    expect((await repository.load()).challenges).toHaveLength(initial.challenges.length)
    expect(await screen.findByRole('link', { name: /Preparar desaf.o/ })).toHaveAttribute('href', '/admin/desafios/nuevo?solicitud=solicitud-1')
  })

  it('admin: publica y edita un desafio con fechas de Buenos Aires', async () => {
    const user = userEvent.setup()
    openRoute('/admin/desafios/nuevo?solicitud=solicitud-3', 'admin')
    expect(await screen.findByRole('heading', { name: /Nuevo desaf.o/ })).toBeVisible()
    expect(screen.getByLabelText(/T.tulo de la consigna/)).toHaveValue('Paisajes sonoros del barrio')
    fireEvent.change(screen.getByLabelText('Inicio (Buenos Aires)'), { target: { value: '2027-01-02T10:00' } })
    fireEvent.change(screen.getByLabelText('Cierre (Buenos Aires)'), { target: { value: '2027-01-09T18:00' } })
    await user.click(screen.getByRole('button', { name: /Publicar desaf.o/ }))
    await waitFor(async () => expect((await repository.load()).challenges.find(challenge => challenge.requestId === 'solicitud-3')?.startsAt).toBe('2027-01-02T13:00:00.000Z'))
    await user.click(await screen.findByRole('link', { name: 'Editar Paisajes sonoros del barrio' }, { timeout: 8000 }))
    expect(await screen.findByLabelText('Cierre (Buenos Aires)')).toHaveValue('2027-01-09T18:00')
    fireEvent.change(screen.getByLabelText('Cierre (Buenos Aires)'), { target: { value: '2027-01-09T19:00' } })
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(async () => expect((await repository.load()).challenges.find(challenge => challenge.requestId === 'solicitud-3')?.endsAt).toBe('2027-01-09T22:00:00.000Z'))
  })

  it('admin: archiva y restaura una consigna sin eliminar las obras', async () => {
    const user = userEvent.setup()
    const initial = await repository.load()
    openRoute('/admin/desafios', 'admin')
    await user.click(await screen.findByRole('button', { name: /Archivar Todo empieza/ }))
    let dialog = await screen.findByRole('dialog', { name: /Archivar este desaf.o/ })
    await user.click(within(dialog).getByRole('button', { name: /Archivar desaf.o/ }))
    await waitFor(async () => expect((await repository.load()).challenges.find(challenge => challenge.id === 'desafio-linea')?.archived).toBe(true))
    expect((await repository.load()).posts).toEqual(initial.posts)
    await user.click(await screen.findByRole('button', { name: /Restaurar Todo empieza/ }))
    dialog = await screen.findByRole('dialog', { name: /Restaurar este desaf.o/ })
    await user.click(within(dialog).getByRole('button', { name: /Restaurar desaf.o/ }))
    await waitFor(async () => expect((await repository.load()).challenges.find(challenge => challenge.id === 'desafio-linea')?.archived).toBe(false))
  })
})
