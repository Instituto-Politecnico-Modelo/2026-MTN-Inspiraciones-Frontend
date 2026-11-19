import {useCallback, useEffect, useState} from 'react'
import {excelReports, type ExcelReport} from '../data/api'
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
export function ExcelReportsPanel() {
  const [dates] = useState(initialDates)
  const [type,setType] = useState(types[0].value)
  const [start,setStart] = useState(dates.start)
  const [end,setEnd] = useState(dates.end)
  const [latest,setLatest] = useState<ExcelReport>()
  const [history,setHistory] = useState<ExcelReport[]>([])
  const [nextPage,setNextPage] = useState<number|null>(null)
  const [historyLoading,setHistoryLoading] = useState(true)
  const [pending,setPending] = useState(false)
  const [error,setError] = useState('')
  const loadHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true)
    try {
      const result = await excelReports.history(page)
      const incoming = result.items.map(({solicitudId,...report})=>({...report,id:solicitudId}))
      setHistory(previous=>[...new Map([...(page===1?[]:previous),...incoming].map(report=>[report.id,report])).values()])
      setNextPage(result.pagina * result.tamanioPagina < result.totalItems ? result.pagina + 1 : null)
      setError('')
    } catch (failure) {setError(errorMessage(failure))}
    finally {setHistoryLoading(false)}
  },[])
  useEffect(()=>{void loadHistory()},[loadHistory])
  const id = latest?.id, state = latest?.estado
  useEffect(()=>{
    if(!id || state!=='PENDIENTE')return
    let active=true, attempts=0
    let timer:ReturnType<typeof setTimeout>
    const poll=async()=>{
      try {
        const report=await excelReports.status(id)
        if(!active)return
        setLatest(previous=>({...previous!,...report}))
        if(report.estado!=='PENDIENTE'){await loadHistory();return}
        if(++attempts<60)timer=setTimeout(()=>void poll(),2000)
        else setError('El reporte está tardando más de lo habitual. Actualizá el estado para volver a consultarlo.')
      } catch(failure){if(active)setError(errorMessage(failure))}
    }
    timer=setTimeout(()=>void poll(),2000)
    return()=>{active=false;clearTimeout(timer)}
  },[id,state,loadHistory])
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
  const reports=latest?[latest,...history.filter(report=>report.id!==latest.id)]:history
  return <section aria-labelledby="excel-reports">
    <h2 id="excel-reports">Reportes Excel</h2>
    <p>Elegí el contenido y el período. El estado y la descarga se actualizan al terminar la generación.</p>
    <form className="filter-row" onSubmit={event=>{
      event.preventDefault()
      if(!start||!end||start>end){setError('Elegí un período válido: la fecha Desde debe ser anterior o igual a Hasta.');return}
      void run(async()=>setLatest({...await excelReports.request(type,start,end),tipoReporte:type,rangoDeFechas:{fechaInicio:start,fechaFin:end}}))
    }}>
      <SelectField label="Tipo de reporte Excel" value={type} options={types} onChange={event=>setType(event.target.value)}/>
      <label>Desde <input type="date" required value={start} onChange={event=>setStart(event.target.value)}/></label>
      <label>Hasta <input type="date" required min={start||undefined} value={end} onChange={event=>setEnd(event.target.value)}/></label>
      <Button type="submit" disabled={pending||latest?.estado==='PENDIENTE'}>Solicitar Excel</Button>
    </form>
    {latest?.estado==='PENDIENTE'&&<p role="status">Preparando tu Excel… La descarga aparecerá cuando esté listo.</p>}
    <Button variant="secondary" disabled={pending||historyLoading} onClick={()=>void run(async()=>{
      await loadHistory()
      if(latest)setLatest({...latest,...await excelReports.status(latest.id)})
    })}>Actualizar historial y estado</Button>
    <ErrorMessage message={error}/>
    {historyLoading&&<p role="status">Cargando historial…</p>}
    {reports.length>0?<div className="table-scroll" role="region" aria-label="Solicitudes de Excel" tabIndex={0}><table className="admin-table" aria-label="Solicitudes de Excel">
      <thead><tr><th scope="col">Reporte</th><th scope="col">Período</th><th scope="col">Estado</th><th scope="col">Descarga</th></tr></thead>
      <tbody>{reports.map(report=><tr key={report.id}>
        <th scope="row">{types.find(option=>option.value===report.tipoReporte)?.label??report.tipoReporte}</th>
        <td>{report.rangoDeFechas?`${report.rangoDeFechas.fechaInicio} → ${report.rangoDeFechas.fechaFin}`:'Sin período informado'}</td>
        <td>{report.estado==='CON_ERROR'?(report.motivoError??'Error de generación'):report.estado==='GENERADO'?'Listo para descargar':'En preparación'}</td>
        <td>{report.estado==='GENERADO'&&<Button variant="secondary" disabled={pending} onClick={()=>void run(()=>download(report.id))}>Descargar Excel</Button>}</td>
      </tr>)}</tbody>
    </table></div>:!historyLoading&&!error&&<p role="status">El historial todavía está vacío.</p>}
    {nextPage&&<Button variant="secondary" disabled={historyLoading} onClick={()=>void loadHistory(nextPage)}>Cargar reportes anteriores</Button>}
  </section>
}
