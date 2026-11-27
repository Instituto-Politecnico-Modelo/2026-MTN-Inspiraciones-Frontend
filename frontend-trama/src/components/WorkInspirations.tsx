import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { workInspirations, type WorkInspiration, type WorkSearchFilters, type WorkSearchItem, type WorkSearchPage } from '../data/api'
import { Button, ErrorMessage, Field } from './UI'

type SearchWorks = (filters: WorkSearchFilters, signal: AbortSignal) => Promise<WorkSearchPage>

export function WorkInspirations({ postId, editable, searchWorks }: {
  postId: string
  editable: boolean
  searchWorks?: SearchWorks
}) {
  const [items, setItems] = useState<WorkInspiration[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [results, setResults] = useState<WorkSearchItem[]>()

  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    workInspirations.list(postId).then(value => { if (active) setItems(value) })
      .catch(() => { if (active) setError('No se pudieron cargar las obras de inspiración.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [postId])

  const search = async (event: FormEvent) => {
    event.preventDefault()
    const query = text.trim()
    if (query.length < 2 || !searchWorks) return
    setPending(true); setError('')
    try {
      const page = await searchWorks({ query, style: '', discipline: '', technique: '', contentType: '', order: 'recientes' }, new AbortController().signal)
      setResults(page.items.filter(item => item.id !== postId))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo buscar obras en Trama.')
    } finally { setPending(false) }
  }
  const link = async (work: WorkSearchItem) => {
    setPending(true); setError('')
    try {
      const linked = await workInspirations.link(postId, work.id)
      setItems(current => [...current.filter(item => item.id !== linked.id), linked])
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo vincular la obra.')
    } finally { setPending(false) }
  }
  const remove = async (item: WorkInspiration) => {
    setPending(true); setError('')
    try {
      await workInspirations.remove(postId, item.id)
      setItems(current => current.filter(value => value.id !== item.id))
    } catch { setError('No se pudo quitar la obra de inspiración. Reintentá.') }
    finally { setPending(false) }
  }
  const linkedIds = new Set(items.map(item => item.id))

  return <section className="comments-section" aria-labelledby="obras-inspiracion">
    <h2 id="obras-inspiracion">Obras de Trama como inspiración</h2>
    {loading ? <p role="status">Cargando obras de inspiración…</p>
      : items.length === 0 && <p className="muted">Esta obra todavía no tiene otras obras de Trama como inspiración.</p>}
    <ul className="form-stack">{items.map(item => <li key={item.id} className="work-inspiration-row">
      {item.thumbnail && <img src={item.thumbnail} alt="" width={56} height={56} />}
      <div><Link to={`/obra/${encodeURIComponent(item.id)}`}><strong>{item.title}</strong></Link></div>
      {editable && <Button variant="secondary" disabled={pending} aria-label={`Quitar ${item.title} como inspiración`}
        onClick={() => void remove(item)}>Quitar</Button>}
    </li>)}</ul>
    {editable && searchWorks && <div className="form-stack">
      <form className="music-catalog-search" onSubmit={event => void search(event)}>
        <Field type="search" label="Buscar una obra de Trama" value={text} maxLength={100} disabled={pending}
          onChange={event => setText(event.target.value)} hint="Escribí al menos dos caracteres." />
        <Button type="submit" variant="secondary" disabled={pending || text.trim().length < 2}>Buscar obra</Button>
      </form>
      {results && !results.length && <p role="status" className="meta">No se encontraron obras para esta búsqueda.</p>}
      {!!results?.length && <ul className="music-catalog-results" aria-label="Obras encontradas">
        {results.map(work => <li className="music-catalog-row" key={work.id}>
          <div><h4>{work.title}</h4></div>
          {linkedIds.has(work.id) ? <span className="music-catalog-linked">Vinculada</span>
            : <Button variant="secondary" aria-label={`Vincular ${work.title} como inspiración`} disabled={pending}
              onClick={() => void link(work)}>Vincular</Button>}
        </li>)}
      </ul>}
    </div>}
    <ErrorMessage message={error} />
  </section>
}
