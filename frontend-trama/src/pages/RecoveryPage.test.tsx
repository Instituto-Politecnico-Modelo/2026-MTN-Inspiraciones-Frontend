import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { RecoveryPage } from './Access'

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }))
vi.mock('../context/DemoContext', () => ({ useDemo: () => ({ logout }) }))

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function open() {
  render(<MemoryRouter initialEntries={['/recuperar']}><RecoveryPage /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'persona@example.com' } })
}

it('conecta solicitud y confirmación sin necesitar sesión y conserva el cero inicial', async () => {
  localStorage.setItem('trama-token', 'token-vencido')
  const fetch = vi.fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 202 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)
  open()
  expect(fetch).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
  const code = await screen.findByLabelText('Código de seis dígitos')
  expect(screen.getByText(/Si hay una cuenta activa/)).toBeVisible()
  fireEvent.change(code, { target: { value: '012345' } })
  fireEvent.change(screen.getByLabelText(/^Contraseña nueva$/), { target: { value: 'Ejemplo!482' } })
  fireEvent.change(screen.getByLabelText(/^Repetir contraseña$/), { target: { value: 'distinta' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
  expect(screen.getByText(/Las contraseñas no coinciden/)).toBeVisible()
  expect(fetch).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByLabelText(/^Repetir contraseña$/), { target: { value: 'Ejemplo!482' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
  expect(await screen.findByRole('link', { name: 'Ir a ingresar' })).toHaveAttribute('href', '/ingresar')
  expect(fetch.mock.calls.map(([url, init]) => [url, init?.headers, JSON.parse(String(init?.body))])).toEqual([
    ['/api/auth/password-reset/request', { 'Content-Type': 'application/json' }, { email: 'persona@example.com' }],
    ['/api/auth/password-reset/confirm', { 'Content-Type': 'application/json' }, { email: 'persona@example.com', code: '012345', newPassword: 'Ejemplo!482' }],
  ])
  expect(logout).toHaveBeenCalledTimes(1)
  expect(screen.queryByLabelText('Código de seis dígitos')).toBeNull()
})

it('permite retomar un código sin enviar correo y respeta Retry-After al reenviar', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(
    JSON.stringify({ code: 'DEMASIADAS_SOLICITUDES' }),
    { status: 429, headers: { 'Retry-After': '91' } },
  ))
  vi.stubGlobal('fetch', fetch)
  open()
  fireEvent.click(screen.getByRole('button', { name: 'Ya tengo un código' }))
  expect(await screen.findByLabelText('Código de seis dígitos')).toBeVisible()
  expect(fetch).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Reenviar código' }))
  const resend = await screen.findByRole('button', { name: /Reenviar en 9[01] s/ })
  expect(resend).toBeDisabled()
  expect(fetch).toHaveBeenCalledTimes(1)
})
