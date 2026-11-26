import {act,cleanup,render,screen,waitFor,within} from '@testing-library/react'
import {MemoryRouter,useLocation} from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {ExcelReportsPanel} from './ExcelReports'
const api=vi.hoisted(()=>({history:vi.fn(),request:vi.fn(),status:vi.fn(),download:vi.fn()}))
vi.mock('../data/api',async importOriginal=>({...await importOriginal<typeof import('../data/api')>(),excelReports:api}))
const generated={solicitudId:'old',tipoReporte:'DESAFIOS',estado:'GENERADO',rangoDeFechas:{fechaInicio:'2026-11-01',fechaFin:'2026-11-15'}}
beforeEach(()=>{
 api.history.mockResolvedValue({items:[generated],pagina:1,totalItems:1,tamanioPagina:20})
 api.request.mockResolvedValue({id:'new',estado:'PENDIENTE'})
 api.status.mockResolvedValue({id:'new',estado:'GENERADO',tipoReporte:'DESAFIOS'})
 api.download.mockResolvedValue(new Blob(['xlsx']))
})
afterEach(()=>{cleanup();vi.clearAllMocks();vi.useRealTimers()})
function Location() {
 const {search}=useLocation()
 return <output aria-label="Selección URL">{search}</output>
}
const panel=(path='/admin/reportes')=>render(<MemoryRouter initialEntries={[path]}><ExcelReportsPanel/><Location/></MemoryRouter>)
describe('reportes conectados',()=>{
 it('carga el historial al entrar y ofrece descargarlo',async()=>{
  panel()
  expect(await screen.findByRole('button',{name:'Descargar Excel'})).toBeVisible()
  expect(api.history).toHaveBeenCalledWith(1)
  expect(screen.getByLabelText('Desde')).not.toHaveValue('')
  expect(screen.getByLabelText('Hasta')).not.toHaveValue('')
 })
 it('actualiza automáticamente un reporte pendiente hasta permitir su descarga',async()=>{
  api.history.mockResolvedValue({items:[],pagina:1,totalItems:0,tamanioPagina:20})
  panel()
  await userEvent.click(screen.getByRole('button',{name:'Solicitar Excel'}))
  await waitFor(()=>expect(api.status).toHaveBeenCalledWith('new'),{timeout:6000})
  expect(await screen.findByRole('button',{name:'Descargar Excel'})).toBeVisible()
  expect(screen.queryByText('PENDIENTE')).not.toBeInTheDocument()
 })
 it('muestra y permite recuperar un error de historial',async()=>{
  api.history.mockRejectedValueOnce(new Error('Historial no disponible.'))
  panel()
  expect(await screen.findByRole('alert')).toHaveTextContent('Historial no disponible.')
  await userEvent.click(screen.getByRole('button',{name:'Actualizar historial y estado'}))
  expect(await screen.findByRole('button',{name:'Descargar Excel'})).toBeVisible()
 })
 it('ofrece cargar páginas anteriores sin repetir reportes',async()=>{
  api.history.mockResolvedValueOnce({items:[generated],pagina:1,totalItems:2,tamanioPagina:1})
   .mockResolvedValue({items:[{...generated,solicitudId:'older'}],pagina:2,totalItems:2,tamanioPagina:1})
  panel()
  await userEvent.click(await screen.findByRole('button',{name:'Cargar reportes anteriores'}))
  await waitFor(()=>expect(api.history).toHaveBeenCalledWith(2))
  expect(within(screen.getByRole('table')).getAllByRole('button',{name:'Descargar Excel'})).toHaveLength(2)
 })
 it('recupera un enlace fuera del historial y consulta EN_PROCESO hasta el estado terminal',async()=>{
  vi.useFakeTimers()
  api.status.mockResolvedValueOnce({id:'aviso',tipoReporte:'DESAFIOS',estado:'EN_PROCESO'})
   .mockResolvedValueOnce({id:'aviso',tipoReporte:'DESAFIOS',estado:'CON_ERROR',motivoError:'No hay datos para el período.'})
  panel('/admin/reportes?solicitudId=aviso')
  await act(async()=>{})
  expect(api.status).toHaveBeenCalledWith('aviso')
  expect(screen.getByText('En proceso',{exact:true})).toBeVisible()
  expect(screen.getByRole('button',{name:'Solicitar Excel'})).toBeEnabled()
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000)})
  expect(screen.getByText('No hay datos para el período.')).toBeVisible()
  await act(async()=>{await vi.advanceTimersByTimeAsync(10000)})
  expect(api.status).toHaveBeenCalledTimes(2)
 })
 it('permite retomar una solicitud activa del historial y refleja la selección en la URL',async()=>{
  api.history.mockResolvedValueOnce({items:[{...generated,estado:'EN_PROCESO'}],pagina:1,totalItems:1,tamanioPagina:20})
  api.status.mockResolvedValueOnce({id:'old',tipoReporte:'DESAFIOS',estado:'EN_PROCESO'})
  panel()
  await userEvent.click(await screen.findByRole('link',{name:/Ver estado/}))
  expect(screen.getByLabelText('Selección URL')).toHaveTextContent('?solicitudId=old')
  await waitFor(()=>expect(api.status).toHaveBeenCalledWith('old'))
 })
 it('mantiene la clave al reintentar un envío y la cambia para otra solicitud',async()=>{
  api.request.mockRejectedValueOnce(new Error('Se perdió la respuesta.'))
  panel()
  const submit=screen.getByRole('button',{name:'Solicitar Excel'})
  await userEvent.click(submit)
  expect(await screen.findByRole('alert')).toHaveTextContent('Se perdió la respuesta.')
  await userEvent.click(submit)
  await waitFor(()=>expect(screen.getByLabelText('Selección URL')).toHaveTextContent('?solicitudId=new'))
  expect(submit).toBeEnabled()
  await userEvent.click(submit)
  const keys=api.request.mock.calls.map(call=>call[3])
  expect(keys[0]).toEqual(expect.any(String))
  expect(keys[1]).toBe(keys[0])
  expect(keys[2]).not.toBe(keys[0])
 })
})
