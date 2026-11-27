import { useEffect, useMemo, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useDemo, type Backend } from '../context/DemoContext'
import { disciplines, type Post, type User } from '../data/model'
import { placesApi, type MapPublication, type WorkSearchFilters, type WorkSearchPage } from '../data/api'
import type { CatalogDiscipline } from '../data/places'
import { errorMessage, normalize, profilePath, searchPosts, visiblePosts } from '../data/store'
import { Avatar, Button, EmptyState, ErrorMessage, Modal, PageTitle, SearchField, SelectField, Tabs } from '../components/UI'
import { PostCard, PostGrid } from '../components/PostCard'
import { FollowButton } from '../components/FollowButton'
import { PlacesExplorer } from '../components/PlacesExplorer'
import { proximityAccess, type LocationPreference } from '../data/places'
import { getPosition } from '../lib/geolocation'
import { useDevicePermission } from '../lib/useDevicePermission'
import { DiscoverMusic } from './DiscoverMusic'

function DiscoverMap({ filter }: { filter?: (publication: MapPublication) => boolean }) {
  const [preference, setPreference] = useState<LocationPreference>(null)
  const [permission] = useDevicePermission()
  useEffect(() => {
    let active = true
    placesApi.preference.get().then(value => { if (active) setPreference(value) }).catch(() => undefined)
    return () => { active = false }
  }, [])
  return <PlacesExplorer api={placesApi} access={proximityAccess(preference, permission)} getPosition={getPosition} filter={filter} />
}

const tabs = [{ value: 'obras', label: 'Obras' }, { value: 'tutoriales', label: 'Tutoriales' },
  { value: 'artistas', label: 'Artistas' }, { value: 'musica', label: 'Música' }]
const orders = [{ value: 'seleccion', label: 'Selección' }, { value: 'recientes', label: 'Más recientes' },
  { value: 'likes', label: 'Más likes' }, { value: 'titulo', label: 'Por título' }]
const styles = ['Realismo', 'Abstracto', 'Impresionismo', 'Figurativo', 'Cubismo']
const contentTypes = [{ value: 'IMAGEN', label: 'Imágenes' }, { value: 'VIDEO', label: 'Videos' },
  { value: 'AUDIO', label: 'Audio' }, { value: 'TUTORIAL', label: 'Tutoriales' },
  { value: 'TEXTO', label: 'Texto' }, { value: 'MIXTO', label: 'Mixto' }]
const searchDelay = 300

type Filters = { disciplina: string; tecnica: string; estilo: string; contenido: string }
const noFilters: Filters = { disciplina: '', tecnica: '', estilo: '', contenido: '' }

function useWorkSearch(search: Backend['searchWorks'], filters: WorkSearchFilters) {
  const [request, requestPage] = useState<{ filters: WorkSearchFilters; cursor?: string }>()
  const [result, setResult] = useState<{ filters: WorkSearchFilters; request: typeof request; page: WorkSearchPage; error: boolean }>()
  const current = result?.filters === filters ? result : undefined
  const activeRequest = request?.filters === filters ? request : undefined
  const pending = !!search && (!current || current.request !== activeRequest)
  const cursor = activeRequest?.cursor

  useEffect(() => {
    if (!search) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const page = await search({ ...filters, cursor }, controller.signal)
        if (controller.signal.aborted) return
        setResult(previous => {
          const items = new Map((cursor && previous?.filters === filters ? previous.page.items : []).map(item => [item.id, item]))
          page.items.forEach(item => items.set(item.id, item))
          return { filters, request: activeRequest, page: { items: [...items.values()], cursor: page.cursor === cursor ? null : page.cursor }, error: false }
        })
      } catch {
        if (controller.signal.aborted) return
        setResult(previous => ({
          filters, request: activeRequest, page: cursor && previous?.filters === filters ? previous.page : { items: [], cursor: null }, error: true,
        }))
      }
    }, activeRequest || !filters.query.trim() ? 0 : searchDelay)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [search, filters, activeRequest, cursor])

  return { current, pending, requestPage }
}

function WorkSearchCards({ items, localPosts }: { items: WorkSearchPage['items']; localPosts: Map<string, Post> }) {
  const location = useLocation()
  return <div className="artwork-grid compact-grid">
    {items.map((item, index) => {
      const post = localPosts.get(item.id)
      return post ? <PostCard key={item.id} post={post} eager={index < 3} /> : <article className="post-card" key={item.id}>
        <Link className="artwork-link" to={'/obra/' + encodeURIComponent(item.id)} state={{ from: location.pathname + location.search }}>
          {item.thumbnail && <div className="card-media"><img className="discover-thumbnail" src={item.thumbnail} alt="" loading="lazy" /></div>}
          <h2>{item.title}</h2>
        </Link>
      </article>
    })}
  </div>
}
export function DiscoverPage() {
  const { state, user, searchUsers, searchWorks } = useDemo()
  const viewerId = user?.id
  const [params, setParams] = useSearchParams()
  const requested = params.get('tipo') ?? 'obras'
  const tab = tabs.some(item => item.value === requested) ? requested : 'obras'
  const isWork = tab === 'obras' || tab === 'tutoriales'
  const query = params.get('q') ?? ''
  const artistQuery = query.trim().replace(/^@/, '').trim()
  const discipline = params.get('disciplina') ?? ''
  const technique = params.get('tecnica') ?? ''
  const style = params.get('estilo') ?? ''
  const rawContent = params.get('contenido') ?? ''
  const content = contentTypes.some(item => item.value === rawContent) ? rawContent : ''
  const chosenOrder = params.get('orden')
  const order = orders.some(item => item.value === chosenOrder) ? chosenOrder! : 'seleccion'
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draft, setDraft] = useState<Filters>(noFilters)
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)
  const [artistResults, setArtistResults] = useState<User[]>([])
  const [catalog, setCatalog] = useState<CatalogDiscipline[]>([])

  useEffect(() => {
    let active = true
    placesApi.catalog().then(items => { if (active) setCatalog(items) }).catch(() => undefined)
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (tab !== 'artistas' || !viewerId) return
    let active = true
    const timer = window.setTimeout(() => {
      setSearchError('')
      setSearching(true)
      void searchUsers(artistQuery).then(users => {
        if (active) setArtistResults(users)
      }).catch(error => {
        if (active) setSearchError(errorMessage(error))
      }).finally(() => {
        if (active) setSearching(false)
      })
    }, searchDelay)
    return () => { active = false; window.clearTimeout(timer) }
  }, [tab, artistQuery, viewerId, searchUsers])

  const update = (values: Record<string, string>) => {
    const next = new URLSearchParams(params)
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    setParams(next, { replace: true, preventScrollReset: true })
  }

  const disciplineEntry = (value: string) => catalog.find(item => normalize(item.nombre) === normalize(value))
  const disciplineCode = disciplineEntry(discipline)?.codigo ?? (disciplines.some(value => value === discipline) ? normalize(discipline) : '')
  const techniqueCode = disciplineEntry(discipline)?.tecnicas.find(item => normalize(item.nombre) === normalize(technique))?.codigo
  const contentType = tab === 'tutoriales' ? 'TUTORIAL' : content
  const filters = useMemo(() => ({ query, style, discipline: disciplineCode, technique, techniqueCode, contentType, order }),
    [query, style, disciplineCode, technique, techniqueCode, contentType, order])
  const remote = isWork && viewerId ? searchWorks : undefined
  const { current, pending, requestPage } = useWorkSearch(remote, filters)
  const blocked = new Set(state.blocks.map(block => block.blockedId))
  const visibleById = new Map(visiblePosts(state).map(post => [post.id, post]))
  const knownPosts = new Set(state.posts.map(post => post.id))
  const results = (current?.page.items ?? []).filter(item => !blocked.has(item.authorId)
    && (visibleById.has(item.id) || !knownPosts.has(item.id)))
  const localPosts = remote || !isWork ? [] : searchPosts(state, { query, tutorial: tab === 'tutoriales' || content === 'TUTORIAL' || undefined,
    kind: contentType === 'AUDIO' ? 'audio' : contentType === 'VIDEO' ? 'video' : contentType === 'IMAGEN' ? 'image' : undefined,
    discipline, technique }).filter(post => !style || normalize([post.title, post.description, ...(post.ownTags ?? [])].join(' ')).includes(normalize(style)))
  if (order === 'recientes') localPosts.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  if (order === 'titulo') localPosts.sort((a, b) => a.title.localeCompare(b.title, 'es'))
  if (order === 'likes') localPosts.sort((a, b) => b.likes.length - a.likes.length)
  const artists = (viewerId ? artistResults : state.users).filter(candidate => candidate.role === 'artist' && candidate.status === 'active'
    && (!discipline || candidate.disciplines.includes(discipline as typeof disciplines[number]))
    && normalize(`${candidate.name} ${candidate.handle} ${candidate.bio} ${candidate.disciplines.join(' ')}`).includes(normalize(artistQuery)))
  const techniques = new Map<string, string>()
  for (const value of [
    ...state.posts.map(post => post.technique), ...catalog.flatMap(item => item.tecnicas.map(value => value.nombre)),
    'Grafito', 'Acuarela', 'Óleo', 'Digital', 'Carboncillo',
  ]) if (value) techniques.set(normalize(value), value)
  const techniquesOf = (value: string) => disciplineEntry(value)?.tecnicas.map(item => item.nombre) ?? [...techniques.values()]

  const values: Filters = { disciplina: discipline, tecnica: technique, estilo: style, contenido: content }
  const activeFilters = (tab === 'artistas' ? [discipline] : [discipline, technique, style, tab === 'obras' ? content : '']).filter(Boolean).length
  const renderFilters = (mobile = false) => {
    const selected = mobile ? draft : values
    const techniques = techniquesOf(selected.disciplina)
    const selectedTechnique = techniques.find(item => normalize(item) === normalize(selected.tecnica)) ?? ''
    const set = (changes: Partial<Filters>) => {
      const next = { ...selected, ...changes }
      if (mobile) setDraft(next)
      else update(next)
    }
    return <>
      <SelectField label="Disciplina" value={selected.disciplina} onChange={event => {
        const value = event.target.value
        set({ disciplina: value, ...(!value || techniquesOf(value).some(item => normalize(item) === normalize(selected.tecnica)) ? {} : { tecnica: '' }) })
      }} options={[{ value: '', label: 'Todas las disciplinas' }, ...disciplines.map(value => ({ value, label: value }))]} />
      {isWork && <>
        <SelectField label="Técnica" value={selectedTechnique} onChange={event => set({ tecnica: event.target.value })}
          options={[{ value: '', label: 'Todos' }, ...techniques.map(value => ({ value, label: value }))]} />
        <SelectField label="Estilo" value={selected.estilo} onChange={event => set({ estilo: event.target.value })}
          options={[{ value: '', label: 'Todos los estilos' }, ...styles.map(value => ({ value, label: value }))]} />
        {tab === 'obras' && <SelectField label="Tipo de contenido" value={selected.contenido} onChange={event => set({ contenido: event.target.value })}
          options={[{ value: '', label: 'Todos los tipos' }, ...contentTypes]} />}
      </>}
    </>
  }

  const empty = <EmptyState title="Todavía no encontramos coincidencias" description="Probá con otras palabras o quitá los filtros para ampliar tu búsqueda."
    action={<Button variant="secondary" onClick={() => update(activeFilters ? noFilters : { q: '' })}>{activeFilters ? 'Quitar filtros' : 'Limpiar búsqueda'}</Button>} />
  const mapOn = params.get('mapa') === '1' && !!viewerId
  const postIds = new Set((remote ? results : localPosts).map(post => post.id))
  const artistIds = new Set(artists.map(artist => artist.id))
  const mapFilter = remote && !query.trim() && !activeFilters && tab === 'obras' ? undefined : (publication: MapPublication) =>
    tab === 'artistas' ? artistIds.has(String(publication.usuarioId)) : postIds.has(publication.id)
  const count = remote ? results.length : localPosts.length
  const nextCursor = current?.page.cursor
  const status = tab === 'artistas' ? (searching ? 'Buscando artistas…' : `${artists.length} artistas`)
    : pending && !count ? 'Buscando publicaciones…' : `${count} ${count === 1 ? 'resultado' : 'resultados'}`

  return <div className="discover-page">
    <PageTitle title="Descubrir" />
    <div className="discover-search"><SearchField value={query} onChange={value => update({ q: value.slice(0, 500) })}
      label="Buscar en Descubrir" placeholder={tab === 'musica' ? 'Buscá un título, artista o sonido' : 'Buscá obras, técnicas y artistas'} /></div>
    {requested !== tab && <ErrorMessage message="Ese tipo de búsqueda no existe. Elegí Obras, Tutoriales, Artistas o Música." />}
    <Tabs items={tabs} value={tab} label="Qué querés descubrir" onChange={value => { setFiltersOpen(false); update({ tipo: value }) }}>
      {tab === 'musica' ? viewerId
        ? <DiscoverMusic query={query} type={params.get('recurso') === 'sample' ? 'sample' : 'cancion'} onTypeChange={value => update({ recurso: value })} />
        : <EmptyState title="Ingresá para explorar música" description="Buscá canciones, consultá sus letras y encontrá sonidos de Freesound."
          action={<Link className="button button-secondary" to={'/ingresar?volver=' + encodeURIComponent('/descubrir?' + params)}>Ingresar</Link>} />
      : <>
        <div className="filter-row">
          <div className="filter-row discover-filters">{renderFilters()}</div>
          <Button className="filter-toggle" variant="secondary" onClick={() => { setDraft(values); setFiltersOpen(true) }}><SlidersHorizontal size={18} aria-hidden="true" />Filtros{activeFilters ? ` (${activeFilters})` : ''}</Button>
          {isWork && <SelectField label="Orden" value={order} onChange={event => update({ orden: event.target.value })} options={orders} />}
          <label className="check-row map-toggle"><input type="checkbox" checked={mapOn} disabled={!viewerId} onChange={event => update({ mapa: event.target.checked ? '1' : '' })} /> Mapa</label>
          {!!activeFilters && <Button variant="ghost" onClick={() => update(noFilters)}>Limpiar filtros</Button>}
        </div>
        {!(current?.error && !count) && <p className="filter-summary" role="status">{status}{query ? ` para «${query}»` : ''}{activeFilters ? ` · ${activeFilters} ${activeFilters === 1 ? 'filtro activo' : 'filtros activos'}` : ''}</p>}
        {mapOn && <DiscoverMap filter={mapFilter} />}
        {tab === 'artistas' ? <>
          {searchError && <ErrorMessage message={searchError} />}
          {artists.length ? <div className="artist-grid">{artists.map(artist => <article className="artist-card" key={artist.id}>
            <Link to={profilePath(artist)} title={`${artist.name} @${artist.handle}`}><Avatar user={artist} size="large" /><h2>{artist.name}</h2><p className="meta">@{artist.handle}</p></Link>
            <p className="artist-disciplines">{artist.disciplines.join(' · ')}</p><p>{artist.bio}</p><FollowButton artist={artist} />
          </article>)}</div> : !searching && !searchError && empty}
        </> : remote ? <>
          {results.length > 0 && <WorkSearchCards items={results} localPosts={visibleById} />}
          {current?.error && !pending ? <div className="form-stack">
            <ErrorMessage message="No pudimos completar la búsqueda. Volvé a intentar." />
            <Button variant="secondary" onClick={() => requestPage({ filters, cursor: nextCursor ?? undefined })}>Reintentar búsqueda</Button>
          </div> : nextCursor ? <div className="button-row"><Button variant="secondary" loading={pending}
            onClick={() => requestPage({ filters, cursor: nextCursor })}>Cargar más resultados</Button></div>
            : !pending && !count && empty}
        </> : localPosts.length ? <PostGrid posts={localPosts} compact /> : empty}
      </>}
    </Tabs>
    {filtersOpen && <Modal open title="Filtros" onClose={() => setFiltersOpen(false)}><div className="form-stack">{renderFilters(true)}</div><div className="dialog-actions">
      <Button variant="secondary" onClick={() => setDraft(noFilters)}>Limpiar</Button>
      <Button onClick={() => { update(draft); setFiltersOpen(false) }}>Mostrar resultados</Button>
    </div></Modal>}
  </div>
}
