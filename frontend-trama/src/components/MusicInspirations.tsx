import { useEffect, useState, type FormEvent } from 'react'
import { musicalResources, type MusicCatalogItem, type MusicCatalogPage, type MusicalResource, type MusicalResourceType } from '../data/api'
import { Button, ErrorMessage, Field, SelectField } from './UI'

const referenceTypes = [{ value: 'cancion', label: 'Canciones' }, { value: 'sample', label: 'Sonidos de Freesound' }]
const seconds = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

const catalogLabel = (item: MusicCatalogItem) => [
  item.titulo,
  item.artista,
  item.duracionSegundos != null ? `${seconds.format(item.duracionSegundos)} s` : null,
].filter(Boolean).join(' · ')

function MusicCatalogPicker({ linked, pending, onLink }: {
  linked: MusicalResource[]
  pending: boolean
  onLink: (type: MusicalResourceType, id: number) => Promise<boolean>
}) {
  const [query, setQuery] = useState({ type: 'cancion' as MusicalResourceType, text: '', page: 1 })
  const [filter, setFilter] = useState('')
  const [loaded, setLoaded] = useState<{ query: typeof query; page?: MusicCatalogPage }>()
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    let active = true
    musicalResources.catalog(query.type, query.text, query.page)
      .then(page => { if (active) setLoaded({ query, page }) })
      .catch(() => { if (active) setLoaded({ query }) })
    return () => { active = false }
  }, [query])

  const current = loaded?.query === query ? loaded : undefined
  const page = current?.page
  const nextPage = page?.siguientePagina
  const linkedIds = new Set(linked.filter(item => item.tipoRecurso === query.type).map(item => item.id))
  const available = page?.items.filter(item => !linkedIds.has(item.id)) ?? []
  const selected = available.find(item => String(item.id) === selectedId)

  function showPage(page: number, type = query.type, text = query.text) {
    setSelectedId('')
    setQuery({ page, type, text })
  }

  return <div className="form-stack">
    <SelectField label="Tipo de referencia" value={query.type} options={referenceTypes} disabled={pending}
      onChange={event => { setFilter(''); showPage(1, event.target.value as MusicalResourceType, '') }} />
    <form className="form-stack" onSubmit={event => { event.preventDefault(); showPage(1, query.type, filter.trim()) }}>
      <Field type="search" label="Filtrar catálogo" value={filter} maxLength={100} disabled={pending}
        placeholder={query.type === 'cancion' ? 'Título o artista' : 'Nombre del sonido'} onChange={event => setFilter(event.target.value)} />
      <div className="button-row">
        <Button type="submit" variant="secondary" disabled={pending}>Buscar en catálogo</Button>
        {query.text && <Button variant="ghost" disabled={pending}
          onClick={() => { setFilter(''); showPage(1, query.type, '') }}>Quitar filtro</Button>}
      </div>
    </form>
    {!current && <p role="status">Cargando catálogo…</p>}
    {current && !page && <div>
      <ErrorMessage message="No se pudo cargar el catálogo musical." />
      <Button variant="secondary" disabled={pending} onClick={() => showPage(query.page)}>Reintentar catálogo</Button>
    </div>}
    {page && <>
      <SelectField label="Recurso disponible" value={selected?.id ?? ''} disabled={pending || !available.length}
        onChange={event => setSelectedId(event.target.value)}
        options={[{ value: '', label: 'Elegí una referencia' }, ...available.map(item => ({
          value: String(item.id), label: catalogLabel(item),
        }))]} />
      {!available.length && <p role="status">{page.items.length
        ? 'Ya agregaste las referencias de esta página.' : 'No hay recursos guardados para esta búsqueda.'}</p>}
      {selected?.licencia && <p className="field-hint">Licencia: {selected.licencia}</p>}
      <div className="button-row">
        <Button disabled={!selected || pending} onClick={async () => {
          if (selected && await onLink(query.type, selected.id)) setSelectedId('')
        }}>Vincular a la publicación</Button>
        {query.page > 1 && <Button variant="secondary" disabled={pending}
          onClick={() => showPage(query.page - 1)}>Página anterior</Button>}
        {nextPage && <Button variant="secondary" disabled={pending}
          onClick={() => showPage(nextPage)}>Siguiente página</Button>}
      </div>
    </>}
  </div>
}

export function MusicInspirations({ postId, editable }: { postId: string; editable: boolean }) {
  const [items, setItems] = useState<MusicalResource[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [tipo, setTipo] = useState('cancion')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [soundId, setSoundId] = useState('')
  function remember(resource: MusicalResource) {
    setItems(current => [...current.filter(item => !(item.id === resource.id && item.tipoRecurso === resource.tipoRecurso)), resource])
  }

  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    musicalResources.list(postId).then(value => { if (active) setItems(value) })
      .catch(() => { if (active) setError('No se pudieron cargar las inspiraciones musicales.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [postId])
  const add = async (event: FormEvent) => {
    event.preventDefault(); setPending(true); setError('')
    try {
      const resource = await musicalResources.resolve(tipo === 'cancion'
        ? { tipoRecurso: tipo, titulo: title, artista: artist }
        : { tipoRecurso: tipo, id: Number(soundId) })
      const linked = await musicalResources.link(postId, resource)
      remember(linked)
      setTitle(''); setArtist(''); setSoundId('')
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo añadir la inspiración.') }
    finally { setPending(false) }
  }
  const linkFromCatalog = async (tipoRecurso: MusicalResourceType, id: number) => {
    setPending(true); setError('')
    try {
      remember(await musicalResources.link(postId, { tipoRecurso, id }))
      return true
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo vincular la referencia.')
      return false
    } finally { setPending(false) }
  }
  const remove = async (item: MusicalResource) => {
    setPending(true); setError('')
    try { await musicalResources.remove(postId, item); setItems(current => current.filter(value => value !== item)) }
    catch { setError('No se pudo quitar la inspiración. Reintentá.') }
    finally { setPending(false) }
  }
  return <section className="comments-section" aria-label="Inspiraciones musicales">
    <h2>Inspiraciones musicales</h2>
    {loading ? <p role="status">Cargando inspiraciones…</p> : items.length === 0 && <p className="muted">Esta obra todavía no tiene referencias musicales.</p>}
    <ul className="form-stack">{items.map(item => <li key={`${item.tipoRecurso}-${item.id}`}>
      <strong>{item.titulo}</strong>{item.artista && <p>{item.artista}</p>}
      {item.letraCompleta && <details><summary>Ver letra de referencia</summary><p style={{ whiteSpace: 'pre-wrap' }}>{item.letraCompleta}</p></details>}
      {item.urlExterna?.startsWith('https://') && <audio controls preload="none" src={item.urlExterna} aria-label={`Escuchar ${item.titulo}`} style={{ maxWidth: '100%' }} />}
      {item.duracionSegundos != null && <p className="field-hint">Duración: {seconds.format(item.duracionSegundos)} s</p>}
      {item.licencia && <p className="field-hint">Licencia: {item.licencia}</p>}
      {editable && <Button variant="secondary" disabled={pending} onClick={() => void remove(item)}>Quitar referencia</Button>}
    </li>)}</ul>
    {editable && <div className="form-stack">
      <MusicCatalogPicker linked={items} pending={pending || loading} onLink={linkFromCatalog} />
      <details><summary>Buscar otro recurso</summary>
        <form className="form-stack" onSubmit={event => void add(event)}>
          <SelectField label="Añadir una referencia musical" value={tipo} disabled={pending}
            onChange={event => setTipo(event.target.value)}
            options={[{ value: 'cancion', label: 'Canción' }, { value: 'sample', label: 'Sonido de Freesound' }]} />
          {tipo === 'cancion' ? <>
            <Field label="Título de la canción" value={title} onChange={event => setTitle(event.target.value)}
              required maxLength={255} disabled={pending} />
            <Field label="Artista de la canción" value={artist} onChange={event => setArtist(event.target.value)}
              required maxLength={255} disabled={pending} />
          </> : <Field label="Identificador del sonido en Freesound" type="number" min={1} step={1} value={soundId}
            onChange={event => setSoundId(event.target.value)} required disabled={pending}
            hint="El número que aparece en la página del sonido de Freesound." />}
          <Button type="submit" loading={pending} disabled={loading}>Consultar y añadir inspiración</Button>
        </form>
      </details>
    </div>}
    <ErrorMessage message={error} />
  </section>
}
