import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { DemoProvider, type Backend } from '../context/DemoContext'
import { DemoRepository } from '../data/repository'
import { AccessPage } from './Access'

let demo: DemoRepository | undefined
afterEach(async () => {
  cleanup()
  await demo?.close()
  localStorage.clear()
  sessionStorage.clear()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

async function renderAccess() {
  demo = new DemoRepository(`trama-access-${crypto.randomUUID()}`)
  const model = await demo.load()
  const person = model.users.find(user => user.id === 'mora')!
  const login = vi.fn().mockResolvedValue(person.id)
  const backend: Backend = {
    load: vi.fn().mockResolvedValue(model), currentUserId: () => null, login,
    execute: vi.fn(), close: vi.fn(), register: vi.fn(), appeal: vi.fn(), logout: vi.fn(), resolveId: id => id,
  }
  render(<MemoryRouter initialEntries={['/ingresar']}><DemoProvider repository={backend}>
    <Routes>
      <Route path="/ingresar" element={<AccessPage />} />
      <Route path="/inicio" element={<h1>Inicio de prueba</h1>} />
    </Routes>
  </DemoProvider></MemoryRouter>)
  fireEvent.change(await screen.findByLabelText('Correo'), { target: { value: person.email } })
  return login
}

it('permite ingresar aunque el navegador esté esperando limpiar las notificaciones de otra cuenta', async () => {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true, value: { getRegistration: vi.fn(() => new Promise(() => {})) },
  })
  localStorage.setItem('trama-push-device', JSON.stringify({ userId: 'cuenta-anterior', token: 'qa-device' }))
  localStorage.setItem('trama-token', 'sesion-anterior')
  const login = await renderAccess()
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Legacy!462' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
  expect(await screen.findByRole('heading', { name: 'Inicio de prueba' })).toBeVisible()
  expect(login).toHaveBeenCalledOnce()
  expect(localStorage.getItem('trama-push-device')).toBeNull()
})

it('envía una contraseña de ingreso ya existente aunque tenga menos de ocho caracteres', async () => {
  const login = await renderAccess()
  const password = screen.getByLabelText('Contraseña')
  expect(password).not.toHaveAttribute('minlength')
  fireEvent.change(password, { target: { value: 'Test!7' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
  expect(await screen.findByRole('heading', { name: 'Inicio de prueba' })).toBeVisible()
  expect(login).toHaveBeenCalledWith(expect.any(String), 'Test!7')
})
