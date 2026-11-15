import {cleanup,render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {MemoryRouter} from 'react-router-dom'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {AdminReportsPage} from '../pages/Admin'
const api=vi.hoisted(()=>({page:vi.fn()}))
vi.mock('../data/api',()=>({getToken:()=> 'test-auth',adminActivity:api}))
vi.mock('./ExcelReports',()=>({ExcelReportsPanel:()=> <section aria-label="Reportes Excel"/>}))
vi.mock('../context/DemoContext',()=>({useDemo:()=>({state:{users:[],posts:[],challenges:[],reports:[],requests:[],audit:[]}})}))
const event={id:'event',actorId:'admin',targetId:'post',label:'Reporte aceptado',createdAt:'2026-11-15T12:00:00Z'}
beforeEach(()=>api.page.mockResolvedValue({items:[event],totalItems:1,nextPage:null}))
afterEach(()=>{cleanup();vi.clearAllMocks()})
describe('actividad administrativa real',()=>{
 it('carga las acciones del servidor aunque el estado local no tenga auditoría',async()=>{
  render(<MemoryRouter><AdminReportsPage/></MemoryRouter>)
  expect(await screen.findByText('Reporte aceptado')).toBeVisible()
  expect(api.page).toHaveBeenCalledWith(0)
  expect(screen.getByRole('button',{name:'Exportar CSV'})).toBeEnabled()
 })
 it('informa un error de carga y permite reintentar sin afirmar que no existen datos',async()=>{
  api.page.mockRejectedValueOnce(new Error('Actividad no disponible.'))
  render(<MemoryRouter><AdminReportsPage/></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('Actividad no disponible.')
  expect(screen.queryByText('No hay datos en esta selección')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button',{name:'Actualizar actividad'}))
  expect(await screen.findByText('Reporte aceptado')).toBeVisible()
 })
})
