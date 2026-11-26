import {useCallback, useEffect, useRef, useState} from 'react'
import {Link, useSearchParams} from 'react-router-dom'
import {ApiError, excelReports, type ExcelReport} from '../data/api'
import {errorMessage} from '../data/store'
import {Button, ErrorMessage, SelectField} from './UI'

const types = [
  {value:'DESAFIOS',label:'Desafíos'}, {value:'MODERACION',label:'Moderación'},
  {value:'ACTIVIDAD_USUARIOS',label:'Actividad de usuarios'}, {value:'RANKING_INSPIRACION',label:'Ranking de inspiración'},
]
function initialDates() {
  const now = new Date(Date.now() - 3 * 3600000)
  const end = now.toISOString().slice(0,10)
  now.setUTCDate(now.getUTCDate() - 30)
  return {start:now.toISOString().slice(0,10),end}
}
const isActive = (estado: ExcelReport['estado']) => estado === 'PENDIENTE' || estado === 'EN_PROCESO'
const stateLabel: Record<ExcelReport['estado'], string> = {
  PENDIENTE: 'Pendiente', EN_PROCESO: 'En proceso', GENERADO: 'Listo para descargar', CON_ERROR: 'Error de generación',
}
export function ExcelReportsPanel() {
  const [params,setParams] = useSearchParams()
  const id = params.get('solicitudId') || ''
  const selection = (reportId: string) => {
    const next = new URLSearchParams(params)
    next.set('solicitudId', reportId)
    return next
  }
  const [dates] = useState(initialDates)
  const [type,setType] = useState(types[0].value)
  const [start,setStart] = useState(dates.start)
  const [end,setEnd] = useState(dates.end)
  const [selectedReport,setSelectedReport] = useState<ExcelReport>()
  const [statusError,setStatusError] = useState<{id:string; message:string}>()
  const [statusRefresh,setStatusRefresh] = useState(0)
  const [history,setHistory] = useState<ExcelReport[]>([])
  const [nextPage,setNextPage] = useState<number|null>(null)
  const [historyLoading,setHistoryLoading] = useState(true)
  const [pending,setPending] = useState(false)
  const [submitting,setSubmitting] = useState(false)
  const sending = useRef(false)
  const intention = useRef<string>(undefined)
  const [error,setError] = useState('')
  const [historyError,setHistoryError] = useState('')
  const loadHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true)
    try {
      const result = await excelReports.history(page)
      const incoming = result.items.map(({solicitudId,...report})=>({...report,id:solicitudId}))
      setHistory(previous=>[...new Map([...(page===1?[]:previous),...incoming].map(report=>[report.id,report])).values()])
      setNextPage(result.pagina * result.tamanioPagina < result.totalItems ? result.pagina + 1 : null)
      setHistoryError('')
    } catch (failure) {setHistoryError(errorMessage(failure))}
    finally {setHistoryLoading(false)}
  },[])
  useEffect(()=>{void loadHistory()},[loadHistory])
  useEffect(()=>{
    if(!id)return
    let active=true, attempts=0
    let timer:ReturnType<typeof setTimeout>
    const poll=async()=>{
      try {
        const report=await excelReports.status(id)
        if(!active)return
        setSelectedReport(previous=>({...((previous?.id===id)?previous:undefined),...report}))
        setHistory(previous=>previous.map(item=>item.id===id?{...item,...report}:item))
        setStatusError(undefined)
        if(isActive(report.estado))timer=setTimeout(()=>void poll(),++attempts<60?2000:10000)
      } catch(failure){
        if(!active)return
        setStatusError({id,message:errorMessage(failure)})
        if(!(failure instanceof ApiError)||![400,401,403,404].includes(failure.status))timer=setTimeout(()=>void poll(),10000)
      }
    }
    void poll()
    return()=>{active=false;clearTimeout(timer)}
  },[id,statusRefresh])
  const request = async () => {
    if(sending.current)return
    if(!start||!end||start>end){setError('Elegí un período válido: la fecha Desde debe ser anterior o igual a Hasta.');return}
    sending.current=true
    setSubmitting(true);setError('')
    try {
      const key=intention.current??(intention.current=crypto.randomUUID())
      const report={...await excelReports.request(type,start,end,key),tipoReporte:type,rangoDeFechas:{fechaInicio:start,fechaFin:end}}
      intention.current=undefined
      setSelectedReport(report)
      setHistory(previous=>[report,...previous.filter(item=>item.id!==report.id)])
      setParams(selection(report.id))
      setStatusRefresh(previous=>previous+1)
    } catch (failure) {setError(errorMessage(failure))}
    finally {sending.current=false;setSubmitting(false)}
  }
  const run=async(action:()=>Promise<void>)=>{
    setPending(true);setError('')
    try{await action()}catch(failure){setError(errorMessage(failure))}finally{setPending(false)}
  }
  const download=async(id:string)=>{
    const url=URL.createObjectURL(await excelReports.download(id))
    const link=document.createElement('a')
    link.href=url;link.download=`trama-reporte-${id}.xlsx`;document.body.append(link)
    link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  const saved=history.find(report=>report.id===id)
  const selected=selectedReport?.id===id?{...saved,...selectedReport}:saved
  const reports=selected?[selected,...history.filter(report=>report.id!==id)]:history
  const currentStatusError=statusError?.id===id?statusError.message:''
  return <section aria-labelledby="excel-reports">
    <h2 id="excel-reports">Reportes Excel</h2>
    <p>Elegí el contenido y el período. El estado y la descarga se actualizan al terminar la generación.</p>
    <form className="filter-row" onSubmit={event=>{
      event.preventDefault()
      void request()
    }}>
      <SelectField label="Tipo de reporte Excel" disabled={submitting} value={type} options={types} onChange={event=>{intention.current=undefined;setType(event.target.value)}}/>
      <label>Desde <input type="date" required disabled={submitting} value={start} onChange={event=>{intention.current=undefined;setStart(event.target.value)}}/></label>
      <label>Hasta <input type="date" required disabled={submitting} min={start||undefined} value={end} onChange={event=>{intention.current=undefined;setEnd(event.target.value)}}/></label>
      <Button type="submit" disabled={submitting} onClick={event=>{if(event.detail>1)event.preventDefault()}}>Solicitar Excel</Button>
    </form>
    {selected&&isActive(selected.estado)&&<p role="status">Tu Excel se está preparando. Podés seguir usando Trama; te avisaremos cuando termine.</p>}
    {id&&!selected&&!currentStatusError&&<p role="status">Consultando la solicitud…</p>}
    <Button variant="secondary" disabled={historyLoading} onClick={()=>{
      setStatusRefresh(previous=>previous+1)
      void loadHistory()
    }}>Actualizar historial y estado</Button>
    <ErrorMessage message={error}/>
    <ErrorMessage message={historyError}/>
    <ErrorMessage message={currentStatusError}/>
    {historyLoading&&<p role="status">Cargando historial…</p>}
    {reports.length>0?<div className="table-scroll" role="region" aria-label="Solicitudes de Excel" tabIndex={0}><table className="admin-table" aria-label="Solicitudes de Excel">
      <thead><tr><th scope="col">Reporte</th><th scope="col">Período</th><th scope="col">Estado</th><th scope="col">Descarga</th></tr></thead>
      <tbody>{reports.map(report=><tr key={report.id}>
        <th scope="row">{types.find(option=>option.value===report.tipoReporte)?.label??report.tipoReporte}{report.id===id&&<small> · Solicitud seleccionada</small>}</th>
        <td>{report.rangoDeFechas?`${report.rangoDeFechas.fechaInicio} → ${report.rangoDeFechas.fechaFin}`:'Sin período informado'}</td>
        <td aria-live={report.id===id?'polite':undefined}>{report.estado==='CON_ERROR'?(report.motivoError||stateLabel.CON_ERROR):stateLabel[report.estado]}</td>
        <td>
          {report.estado==='GENERADO'&&<Button variant="secondary" disabled={pending} onClick={()=>void run(()=>download(report.id))}>Descargar Excel</Button>}
          {report.estado!=='GENERADO'&&report.id!==id&&<Link className="button button-secondary" to={{search:selection(report.id).toString()}}>Ver estado</Link>}
        </td>
      </tr>)}</tbody>
    </table></div>:!historyLoading&&!historyError&&<p role="status">El historial todavía está vacío.</p>}
    {nextPage&&<Button variant="secondary" disabled={historyLoading} onClick={()=>void loadHistory(nextPage)}>Cargar reportes anteriores</Button>}
  </section>
}
