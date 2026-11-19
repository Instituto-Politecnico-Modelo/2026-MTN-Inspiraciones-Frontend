import { useEffect, useState, type FormEvent } from 'react'
import { musicalResources, type MusicCatalogItem, type MusicCatalogPage, type MusicalResource, type MusicalResourceType } from '../data/api'
import { Button, ErrorMessage, Field, SelectField } from './UI'

const referenceTypes = [{ value: 'cancion', label: 'Canciones' }, { value: 'sample', label: 'Sonidos' }] as const
const seconds = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

function ResourceRows({ label, resources, pending, linked, onLink }: {
  label: string
  resources: MusicCatalogItem[]
  pending: boolean
  linked: (item: MusicCatalogItem) => boolean
  onLink: (item: MusicCatalogItem) => Promise<void>
}) {
  return <ul className="music-catalog-results" aria-label={label}>
    {resources.map(item => <li className="music-catalog-row" key={item.id}>
      <div>
        <h4>{item.titulo}</h4>
        {item.artista && <p className="muted">{item.artista}</p>}
        {item.duracionSegundos != null && <p className="meta">{seconds.format(item.duracionSegundos)} s</p>}
        {item.licencia && (/^https:\/\/(www\.)?creativecommons\.org\//.test(item.licencia)
          ? <p className="meta"><a href={item.licencia} target="_blank" rel="noreferrer">Ver licencia</a></p>
          : <p className="meta">{item.licencia}</p>)}
      </div>
      {linked(item) ? <span className="music-catalog-linked">Vinculado</span>
        : <Button variant="secondary" aria-label={`Vincular ${item.titulo}`} disabled={pending}
          onClick={() => void onLink(item)}>Vincular</Button>}
    </li>)}
  </ul>
}

function MusicCatalogPicker({ linked, pending, onLink, onImport }: {
  linked: MusicalResource[]
  pending: boolean
  onLink: (type: MusicalResourceType, id: number) => Promise<void>
  onImport: (type: MusicalResourceType, item: MusicCatalogItem) => Promise<void>
}) {
  const [query, setQuery] = useState({ type: 'cancion' as MusicalResourceType, text: '', page: 1 })
  const [filter, setFilter] = useState('')
  const [loaded, setLoaded] = useState<{ query: typeof query; page?: MusicCatalogPage }>()
  const [search, setSearch] = useState({ type: query.type, text: '' })
  const [external, setExternal] = useState<{ search: typeof search; results?: MusicCatalogItem[]; error?: string }>()

  useEffect(() => {
    let active = true
    musicalResources.catalog(query.type, query.text, query.page)
      .then(page => { if (active) setLoaded({ query, page }) })
      .catch(() => { if (active) setLoaded({ query }) })
    return () => { active = false }
  }, [query])
  useEffect(() => {
    if (search.text.length < 2) return
    let active = true
    musicalResources.search(search.type, search.text)
      .then(results => {
        if (!Array.isArray(results)) throw new Error('El proveedor devolvió una respuesta incompleta.')
        if (active) setExternal({ search, results })
      })
      .catch(error => {
        if (active) setExternal({ search, error: error instanceof Error ? error.message : 'El proveedor no pudo responder.' })
      })
    return () => { active = false }
  }, [search])

  const current = loaded?.query === query ? loaded : undefined
  const page = current?.page
  const nextPage = page?.siguientePagina
  const externalCurrent = external?.search === search ? external : undefined
  const linkedOfType = linked.filter(item => item.tipoRecurso === query.type)
  const sameSong = (a: MusicCatalogItem, b: MusicCatalogItem) =>
    a.titulo.trim().toLowerCase() === b.titulo.trim().toLowerCase() &&
    a.artista?.trim().toLowerCase() === b.artista?.trim().toLowerCase()
  const isLinked = (item: MusicCatalogItem) => linkedOfType.some(resource => resource.id === item.id)
  const isExternalLinked = (item: MusicCatalogItem) => linkedOfType.some(resource =>
    query.type === 'sample' ? resource.id === item.id : sameSong(resource, item))
  const newResults = externalCurrent?.results?.filter(item => !page?.items.some(saved =>
    query.type === 'sample' ? saved.id === item.id : sameSong(saved, item)))

  function showPage(page: number, type = query.type, text = query.text) {
    setQuery({ page, type, text })
  }
  function runSearch(type: MusicalResourceType, text: string) {
    showPage(1, type, text)
    setSearch({ type, text })
  }

  return <div className="music-catalog">
    <div className="button-row" role="group" aria-label="Tipo de referencia">
      {referenceTypes.map(type => <Button key={type.value} variant={query.type === type.value ? 'primary' : 'secondary'}
        aria-pressed={query.type === type.value} disabled={pending} onClick={() => runSearch(type.value, filter.trim())}>
        {type.label}
      </Button>)}
    </div>
    <form className="music-catalog-search" onSubmit={event => { event.preventDefault(); runSearch(query.type, filter.trim()) }}>
      <Field type="search" label="Filtrar catálogo" value={filter} maxLength={100} disabled={pending}
        placeholder={query.type === 'cancion' ? 'Título o artista' : 'Ej. lluvia o aplausos'} onChange={event => setFilter(event.target.value)} />
      <Button type="submit" variant="secondary" disabled={pending}>Buscar en catálogo</Button>
    </form>
    {query.text && <Button variant="ghost" className="music-clear-search" disabled={pending}
      onClick={() => { setFilter(''); runSearch(query.type, '') }}>Quitar filtro</Button>}
    {search.text.length < 2
      ? <p className="meta">Buscá con dos caracteres o más para encontrar recursos nuevos en {query.type === 'cancion' ? 'Lyrics.ovh' : 'Freesound'}.</p>
      : <div className="music-catalog-group">
        <h3>{query.type === 'cancion' ? 'Canciones nuevas' : 'Sonidos nuevos'}</h3>
        {!externalCurrent && <p role="status" className="meta">Buscando en el proveedor…</p>}
        {externalCurrent?.error && <>
          <ErrorMessage message={externalCurrent.error} />
          <Button variant="secondary" disabled={pending} onClick={() => setSearch({ ...search })}>Reintentar búsqueda externa</Button>
        </>}
        {newResults && !newResults.length && <p role="status" className="meta">No aparecieron recursos nuevos para esta búsqueda.</p>}
        {!!newResults?.length && <ResourceRows label="Resultados externos" resources={newResults} pending={pending}
          linked={isExternalLinked} onLink={item => onImport(query.type, item)} />}
      </div>}
    <div className="music-catalog-group">
      <h3>Guardados en Trama</h3>
      {!current && <p role="status" className="meta">Cargando catálogo…</p>}
      {current && !page && <>
        <ErrorMessage message="No se pudieron cargar los recursos guardados." />
        <Button variant="secondary" disabled={pending} onClick={() => showPage(query.page)}>Reintentar catálogo</Button>
      </>}
      {page && <>
        {page.items.length
          ? <ResourceRows label="Resultados del catálogo" resources={page.items} pending={pending}
            linked={isLinked} onLink={item => onLink(query.type, item.id)} />
          : <p role="status" className="meta">No hay recursos guardados para esta búsqueda.</p>}
        {(query.page > 1 || nextPage) && <div className="button-row">
          {query.page > 1 && <Button variant="secondary" disabled={pending}
            onClick={() => showPage(query.page - 1)}>Página anterior</Button>}
          {nextPage && <Button variant="secondary" disabled={pending}
            onClick={() => showPage(nextPage)}>Siguiente página</Button>}
        </div>}
      </>}
    </div>
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
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo vincular la referencia.')
    } finally { setPending(false) }
  }
  const importFromSearch = async (tipoRecurso: MusicalResourceType, item: MusicCatalogItem) => {
    setPending(true)
    setError('')
    try {
      const resource = await musicalResources.resolve(tipoRecurso === 'cancion'
        ? { tipoRecurso, titulo: item.titulo, artista: item.artista ?? '' } : { tipoRecurso, id: item.id })
      remember(await musicalResources.link(postId, resource))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo vincular el recurso externo.')
    } finally { setPending(false) }
  }
  const remove = async (item: MusicalResource) => {
    setPending(true); setError('')
    try { await musicalResources.remove(postId, item); setItems(current => current.filter(value => value !== item)) }
    catch { setError('No se pudo quitar la inspiración. Reintentá.') }
    finally { setPending(false) }
  }
  return <section className="comments-section" id="inspiraciones-musicales" aria-label="Inspiraciones musicales" tabIndex={-1}>
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
      <MusicCatalogPicker linked={items} pending={pending || loading} onLink={linkFromCatalog} onImport={importFromSearch} />
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
