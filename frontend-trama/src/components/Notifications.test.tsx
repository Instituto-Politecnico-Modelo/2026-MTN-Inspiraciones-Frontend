import {cleanup, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {MemoryRouter} from 'react-router-dom'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {NotificationSettingsPage, Notifications} from './Notifications'

const inbox=vi.hoisted(()=>({list:vi.fn(),read:vi.fn(),readAll:vi.fn()}))
const preferences=vi.hoisted(()=>({list:vi.fn(),save:vi.fn()}))
vi.mock('../context/DemoContext',()=>({useDemo:()=>({user:{id:'receiver'},notify:vi.fn()})}))
vi.mock('../data/api',()=>({getToken:()=> 'test-auth',notificationInbox:inbox,notificationPreferences:preferences}))
vi.mock('../data/push',()=>({notificationsEnabled:()=>false,listenNotifications:()=>()=>{},enableNotifications:vi.fn(),disableNotifications:vi.fn()}))
const notice={id:'persisted',tipo:'COMMENT',titulo:'Nuevo comentario guardado',mensaje:'Otra artista comentó tu publicación.',publicacionId:'work-1',createdAt:'2026-11-15T12:00:00Z'}
beforeEach(()=>{
 inbox.list.mockResolvedValue([notice]);inbox.read.mockImplementation(async()=>{inbox.list.mockResolvedValue([])})
 preferences.list.mockResolvedValue({preferencias:[{tipoEvento:'LIKE',activo:true},{tipoEvento:'COMMENT',activo:false}]})
 preferences.save.mockResolvedValue(undefined)
})
afterEach(()=>{cleanup();vi.clearAllMocks()})
const open=async()=>{render(<MemoryRouter><Notifications/></MemoryRouter>);await userEvent.click(screen.getByRole('button',{name:'Notificaciones'}))}
describe('bandeja persistida',()=>{
 it('muestra avisos anteriores a la sesión sin depender de Firebase y permite leerlos',async()=>{
  await open()
  expect(await screen.findByRole('link',{name:/Nuevo comentario guardado/})).toHaveAttribute('href','/obra/work-1')
  expect(screen.getByRole('link',{name:'Ir a configuración'})).toHaveAttribute('href','/notificaciones/configuracion')
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button',{name:'Marcar como leída: Nuevo comentario guardado'}))
  await waitFor(()=>expect(inbox.read).toHaveBeenCalledWith('persisted'))
  expect(await screen.findByText('No hay notificaciones nuevas')).toBeVisible()
 })
 it('muestra un error recuperable en lugar de afirmar que no hay avisos',async()=>{
  inbox.list.mockRejectedValueOnce(new Error('No pudimos cargar la bandeja.'))
  await open()
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar la bandeja.')
  expect(screen.queryByText('No hay notificaciones nuevas')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button',{name:'Reintentar'}))
  expect(await screen.findByRole('link',{name:/Nuevo comentario guardado/})).toBeVisible()
 })
 it('conserva el aviso si falla su marcado como leído',async()=>{
  inbox.read.mockRejectedValueOnce(new Error('No se pudo marcar el aviso.'))
  await open()
  await userEvent.click(await screen.findByRole('button',{name:'Marcar como leída: Nuevo comentario guardado'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo marcar el aviso.')
  expect(screen.getByRole('link',{name:/Nuevo comentario guardado/})).toBeVisible()
 })
})

describe('configuración separada',()=>{
 it('recupera preferencias y cambia solo el tipo elegido',async()=>{
  render(<MemoryRouter><NotificationSettingsPage/></MemoryRouter>)
  const likes=await screen.findByRole('checkbox',{name:'Me gusta en mis obras'})
  expect(likes).toBeChecked()
  expect(screen.getByRole('checkbox',{name:'Comentarios en mis obras'})).not.toBeChecked()
  await userEvent.click(likes)
  await waitFor(()=>expect(preferences.save).toHaveBeenCalledWith([{tipoEvento:'LIKE',activo:false}]))
  expect(likes).not.toBeChecked()
  expect(screen.getByRole('link',{name:'Volver a notificaciones'})).toHaveAttribute('href','/notificaciones')
 })
 it('no cambia la preferencia visible cuando falla el guardado',async()=>{
  preferences.save.mockRejectedValueOnce(new Error('No pudimos guardar la preferencia.'))
  render(<MemoryRouter><NotificationSettingsPage/></MemoryRouter>)
  await userEvent.click(await screen.findByRole('checkbox',{name:'Me gusta en mis obras'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos guardar la preferencia.')
  expect(screen.getByRole('checkbox',{name:'Me gusta en mis obras'})).toBeChecked()
 })
})
