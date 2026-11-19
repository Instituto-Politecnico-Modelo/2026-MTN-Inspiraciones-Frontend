import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocationNotice, LocationSettings } from './LocationPreference'

type Api = {
  preference: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>; claimNotice: ReturnType<typeof vi.fn> }
}
let api: Api

beforeEach(() => {
  api = { preference: { get: vi.fn().mockResolvedValue('PENDIENTE'), set: vi.fn(), claimNotice: vi.fn().mockResolvedValue(true) } }
})

describe('aviso inicial de ubicación (FR-010)', () => {
  it('se presenta solo cuando el servidor concede el reclamo único', async () => {
    api.preference.claimNotice.mockResolvedValue(false)
    render(<LocationNotice api={api as never} />)

    await waitFor(() => expect(api.preference.claimNotice).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cerrarlo sin elegir deja la decisión pendiente y no vuelve a preguntar', async () => {
    render(<LocationNotice api={api as never} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.preference.set).not.toHaveBeenCalled()
    expect(api.preference.claimNotice).toHaveBeenCalledTimes(1)
  })

  it('permite activar o desactivar y guarda solo la preferencia', async () => {
    api.preference.set.mockResolvedValue('ACTIVADA')
    render(<LocationNotice api={api as never} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Activar ubicación' }))

    expect(api.preference.set).toHaveBeenCalledWith('ACTIVADA')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('no solicita el permiso del dispositivo por sí mismo', async () => {
    const request = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: request } })
    render(<LocationNotice api={api as never} />)
    await screen.findByRole('dialog')

    expect(request).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('configuración de ubicación (FR-010/014)', () => {
  it('permite cambiar la preferencia después', async () => {
    api.preference.get.mockResolvedValue('DESACTIVADA')
    api.preference.set.mockResolvedValue('ACTIVADA')
    render(<LocationSettings api={api as never} permission="granted" />)

    const toggle = await screen.findByRole('checkbox', { name: 'Usar mi ubicación para ver lugares cercanos' })
    expect(toggle).not.toBeChecked()
    await userEvent.click(toggle)

    expect(api.preference.set).toHaveBeenCalledWith('ACTIVADA')
    await waitFor(() => expect(toggle).toBeChecked())
  })

  it('con el permiso del dispositivo denegado conserva la preferencia y guía a corregirlo', async () => {
    api.preference.get.mockResolvedValue('ACTIVADA')
    render(<LocationSettings api={api as never} permission="denied" />)

    expect(await screen.findByRole('checkbox', { name: 'Usar mi ubicación para ver lugares cercanos' })).toBeChecked()
    expect(screen.getByRole('status')).toHaveTextContent(/permiso del dispositivo/i)
    expect(api.preference.set).not.toHaveBeenCalled()
  })

  it('informa si no se pudo guardar sin cambiar el estado mostrado', async () => {
    api.preference.get.mockResolvedValue('DESACTIVADA')
    api.preference.set.mockRejectedValue(new Error('Sin conexión.'))
    render(<LocationSettings api={api as never} permission="granted" />)

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Usar mi ubicación para ver lugares cercanos' }))

    expect(await screen.findByText('Sin conexión.')).toBeVisible()
    expect(screen.getByRole('checkbox', { name: 'Usar mi ubicación para ver lugares cercanos' })).not.toBeChecked()
  })
})
