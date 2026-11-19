import {cleanup,render,screen,waitFor,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {ExcelReportsPanel} from './ExcelReports'
const api=vi.hoisted(()=>({history:vi.fn(),request:vi.fn(),status:vi.fn(),download:vi.fn()}))
vi.mock('../data/api',()=>({excelReports:api}))
const generated={solicitudId:'old',tipoReporte:'DESAFIOS',estado:'GENERADO',rangoDeFechas:{fechaInicio:'2026-11-01',fechaFin:'2026-11-15'}}
beforeEach(()=>{
 api.history.mockResolvedValue({items:[generated],pagina:1,totalItems:1,tamanioPagina:20})
 api.request.mockResolvedValue({id:'new',estado:'PENDIENTE'})
 api.status.mockResolvedValue({id:'new',estado:'GENERADO',tipoReporte:'DESAFIOS'})
 api.download.mockResolvedValue(new Blob(['xlsx']))
})
afterEach(()=>{cleanup();vi.clearAllMocks()})
describe('reportes conectados',()=>{
 it('carga el historial al entrar y ofrece descargarlo',async()=>{
  render(<ExcelReportsPanel/>)
  expect(await screen.findByRole('button',{name:'Descargar Excel'})).toBeVisible()
  expect(api.history).toHaveBeenCalledWith(1)
  expect(screen.getByLabelText('Desde')).not.toHaveValue('')
  expect(screen.getByLabelText('Hasta')).not.toHaveValue('')
 })
 it('actualiza automáticamente un reporte pendiente hasta permitir su descarga',async()=>{
  api.history.mockResolvedValue({items:[],pagina:1,totalItems:0,tamanioPagina:20})
  render(<ExcelReportsPanel/>)
  await userEvent.click(screen.getByRole('button',{name:'Solicitar Excel'}))
  await waitFor(()=>expect(api.status).toHaveBeenCalledWith('new'),{timeout:6000})
  expect(await screen.findByRole('button',{name:'Descargar Excel'})).toBeVisible()
  expect(screen.queryByText('PENDIENTE')).not.toBeInTheDocument()
 })
 it('muestra y permite recuperar un error de historial',async()=>{
  api.history.mockRejectedValueOnce(new Error('Historial no disponible.'))
  render(<ExcelReportsPanel/>)
  expect(await screen.findByRole('alert')).toHaveTextContent('Historial no disponible.')
  await userEvent.click(screen.getByRole('button',{name:'Actualizar historial y estado'}))
  expect(await screen.findByRole('button',{name:'Descargar Excel'})).toBeVisible()
 })
 it('ofrece cargar páginas anteriores sin repetir reportes',async()=>{
  api.history.mockResolvedValueOnce({items:[generated],pagina:1,totalItems:2,tamanioPagina:1})
   .mockResolvedValue({items:[{...generated,solicitudId:'older'}],pagina:2,totalItems:2,tamanioPagina:1})
  render(<ExcelReportsPanel/>)
  await userEvent.click(await screen.findByRole('button',{name:'Cargar reportes anteriores'}))
  await waitFor(()=>expect(api.history).toHaveBeenCalledWith(2))
  expect(within(screen.getByRole('table')).getAllByRole('button',{name:'Descargar Excel'})).toHaveLength(2)
 })
})
