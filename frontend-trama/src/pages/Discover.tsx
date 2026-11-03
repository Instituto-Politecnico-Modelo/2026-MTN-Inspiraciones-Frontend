import { useEffect, useState } from 'react'
import { MapPin, SlidersHorizontal } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDemo } from '../context/DemoContext'
import { disciplines, type User } from '../data/model'
import { places } from '../data/seed'
import { errorMessage, normalize, profilePath, searchPosts, visiblePosts } from '../data/store'
import { Avatar, Button, EmptyState, ErrorMessage, Modal, PageTitle, SearchField, SelectField, Tabs } from '../components/UI'
import { PostGrid } from '../components/PostCard'
import { FollowButton } from '../components/FollowButton'

const tabs = [{ value: 'obras', label: 'Obras' }, { value: 'artistas', label: 'Artistas' }]

export function DiscoverPage() {
  const { state, user, searchUsers } = useDemo()
  const viewerId = user?.id
  const [params, setParams] = useSearchParams()
  const requested = params.get('tipo') ?? 'obras'
  const tab = tabs.some(item => item.value === requested) ? requested : 'obras'
  const query = params.get('q') ?? ''
  const artistQuery = query.trim().replace(/^@/, '').trim()
  const discipline = params.get('disciplina') ?? ''
  const technique = params.get('tecnica') ?? ''
  const order = params.get('orden') ?? 'seleccion'
  const area = params.get('zona') ?? ''
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)
  const [artistResults, setArtistResults] = useState<User[]>([])
  useEffect(() => {
    if (tab !== 'artistas' || !viewerId) return
    let active = true
    const timeout = setTimeout(() => {
      setSearchError('')
      setSearching(true)
      void searchUsers(artistQuery).then(users => {
        if (active) setArtistResults(users)
      }).catch(error => {
        if (active) setSearchError(errorMessage(error))
      }).finally(() => {
        if (active) setSearching(false)
      })
    }, 300)
    return () => { active = false; clearTimeout(timeout) }
  }, [tab, artistQuery, viewerId, searchUsers])
  const [draftDiscipline, setDraftDiscipline] = useState(discipline)
  const [draftTechnique, setDraftTechnique] = useState(technique)
  const [selectedPlace, setSelectedPlace] = useState(places[0].id)
  const update = (values: Record<string, string>) => {
    const next = new URLSearchParams(params)
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    setParams(next, { replace: true, preventScrollReset: true })
  }
  const activeFilters = [discipline, technique].filter(Boolean).length
  const posts = searchPosts(state, { query, kind: tab === 'musica' ? 'audio' : 'image', discipline, technique })
  if (order === 'recientes') posts.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  if (order === 'titulo') posts.sort((a, b) => a.title.localeCompare(b.title, 'es'))
  const artists = (viewerId ? artistResults : state.users).filter(user => user.role === 'artist' && user.status === 'active' && (!discipline || user.disciplines.some(value => value === discipline)) && normalize(`${user.name} ${user.handle} ${user.bio} ${user.disciplines.join(' ')}`).includes(normalize(artistQuery)))
  const filteredPlaces = places.filter(place => (!area || place.area === area) && normalize(`${place.name} ${place.area} ${place.kind}`).includes(normalize(query)))
  const mapPlace = filteredPlaces.find(place => place.id === selectedPlace) ?? filteredPlaces[0]
  const techniqueOptions = Array.from(new Set(visiblePosts(state).filter(post => post.kind === (tab === 'musica' ? 'audio' : 'image')).map(post => post.technique).filter(Boolean)))
  const filters = (mobile = false) => <>
    {tab !== 'musica' && <SelectField label="Disciplina" value={mobile ? draftDiscipline : discipline} onChange={event => mobile ? setDraftDiscipline(event.target.value) : update({ disciplina: event.target.value })}
      options={[{ value: '', label: 'Todas las disciplinas' }, ...disciplines.map(value => ({ value, label: value }))]} />}
    {tab !== 'artistas' && <SelectField label={tab === 'musica' ? 'Tipo de audio' : 'Técnica'} value={mobile ? draftTechnique : technique} onChange={event => mobile ? setDraftTechnique(event.target.value) : update({ tecnica: event.target.value })}
      options={[{ value: '', label: 'Todos' }, ...techniqueOptions.map(value => ({ value, label: value === 'Síntesis' ? 'Piezas musicales' : value === 'Sample' ? 'Samples' : value }))]} />}
  </>
  const empty = <EmptyState title="Todavía no encontramos coincidencias" description="Probá con otras palabras o quitá los filtros para ampliar tu búsqueda."
    action={<Button variant="secondary" onClick={() => activeFilters || area ? update({ disciplina: '', tecnica: '', zona: '' }) : update({ q: '' })}>{activeFilters || area ? 'Quitar filtros' : 'Limpiar búsqueda'}</Button>} />
  return <div className="discover-page">
    <PageTitle title="Descubrir" />
    <div className="discover-search"><SearchField value={query} onChange={value => update({ q: value })} label="Buscar en Descubrir" placeholder={tab === 'musica' ? 'Buscá música, samples o artistas' : tab === 'lugares' ? 'Buscá un espacio o un barrio' : 'Buscá obras, técnicas y artistas'} /></div>
    {requested !== tab && <ErrorMessage message="Ese tipo de búsqueda no existe. Elegí Obras o Artistas." />}
    {tab === 'artistas' && searchError && <ErrorMessage message={searchError} />}
    <Tabs items={tabs} value={tab} label="Qué querés descubrir" onChange={value => update({ tipo: value, disciplina: '', tecnica: '', zona: '' })}>
      {tab !== 'lugares' ? <>
        <div className="filter-row">
          <div className="filter-row discover-filters">{filters()}</div>
          <Button className="filter-toggle" variant="secondary" onClick={() => { setDraftDiscipline(discipline); setDraftTechnique(technique); setFiltersOpen(true) }}><SlidersHorizontal size={18} aria-hidden="true" />Filtros{activeFilters ? ` (${activeFilters})` : ''}</Button>
          {tab !== 'artistas' && <SelectField label="Orden" value={order} onChange={event => update({ orden: event.target.value })} options={[{ value: 'seleccion', label: 'Selección' }, { value: 'recientes', label: 'Más recientes' }, { value: 'titulo', label: 'Por título' }]} />}
          {!!activeFilters && <Button variant="ghost" onClick={() => update({ disciplina: '', tecnica: '' })}>Limpiar filtros</Button>}
        </div>
        <p className="filter-summary" role="status">{tab === 'artistas' ? searching ? 'Buscando artistas…' : `${artists.length} artistas` : `${posts.length} ${posts.length === 1 ? 'resultado' : 'resultados'}`}{query ? ` para «${query}»` : ''}{activeFilters ? ` · ${activeFilters} ${activeFilters === 1 ? 'filtro activo' : 'filtros activos'}` : ''}</p>
        {tab === 'artistas' ? artists.length ? <div className="artist-grid">{artists.map(artist => <article className="artist-card" key={artist.id}>
          <Link to={profilePath(artist)} title={`${artist.name} @${artist.handle}`}><Avatar user={artist} size="large" /><h2>{artist.name}</h2><p className="meta">@{artist.handle}</p></Link>
          <p className="artist-disciplines">{artist.disciplines.join(' · ')}</p><p>{artist.bio}</p><FollowButton artist={artist} />
        </article>)}</div> : empty : posts.length ? <PostGrid posts={posts} compact /> : empty}
      </> : <>
        <div className="filter-row"><SelectField label="Zona de ejemplo" value={area} onChange={event => update({ zona: event.target.value })}
          options={[{ value: '', label: 'Todos los barrios' }, ...places.map(place => ({ value: place.area, label: place.area }))]} /></div>
        <p className="filter-summary" role="status">{filteredPlaces.length} lugares de ejemplo en Buenos Aires. No son direcciones ni servicios reales.</p>
        {filteredPlaces.length ? <div className="places-layout">
          <div className="place-list">{filteredPlaces.map(place => <article className={`place-card ${mapPlace?.id === place.id ? 'is-selected' : ''}`} key={place.id}>
            <img src={place.image} alt="" width="100" height="96" /><div><p className="meta">{place.kind}</p><h2>{place.name}</h2><p className="meta"><MapPin size={15} aria-hidden="true" /> {place.area}</p>
              <Button variant="ghost" onClick={() => setSelectedPlace(place.id)} aria-pressed={mapPlace?.id === place.id}>Ver en el mapa ilustrativo</Button></div>
          </article>)}</div>
          <div className="map-column"><div className="illustrative-map" aria-label="Mapa ilustrativo de los lugares de ejemplo">
            <svg viewBox="0 0 600 520" preserveAspectRatio="none" aria-hidden="true"><rect width="600" height="520" fill="#F1F2F4" /><path d="M10 0v520m100-520v520m100-520v520m100-520v520m100-520v520m100-520v520M0 45h600M0 135h600M0 225h600M0 315h600M0 405h600M0 495h600" stroke="white" strokeWidth="13" /><path d="M-30 80 620 430M60 550 470-30" stroke="#DEDFE3" strokeWidth="25" /><path d="M-30 80 620 430M60 550 470-30" stroke="white" strokeWidth="18" /><rect x="372" y="47" width="94" height="74" rx="12" fill="#DCE5DD" /><rect x="74" y="327" width="103" height="64" rx="12" fill="#DCE5DD" /></svg>
            {filteredPlaces.map(place => <button type="button" key={place.id} className={`map-pin ${mapPlace?.id === place.id ? 'is-active' : ''}`} style={{ left: `${place.x}%`, top: `${place.y}%` }} aria-label={`Mostrar ${place.name}`} aria-pressed={mapPlace?.id === place.id} onClick={() => setSelectedPlace(place.id)}><MapPin size={24} aria-hidden="true" /></button>)}
            <span className="map-caption">Mapa ilustrativo · no usar para orientarse</span>
          </div>{mapPlace && <div className="place-description" aria-live="polite"><h3>{mapPlace.name}</h3><p>{mapPlace.description}</p><p className="meta">{mapPlace.area} · Ubicación ficticia</p></div>}</div>
        </div> : empty}
      </>}
    </Tabs>
    {filtersOpen && <Modal open title="Filtros" onClose={() => setFiltersOpen(false)}><div className="form-stack">{filters(true)}</div><div className="dialog-actions">
      <Button variant="secondary" onClick={() => { setDraftDiscipline(''); setDraftTechnique('') }}>Limpiar</Button>
      <Button onClick={() => { update({ disciplina: draftDiscipline, tecnica: draftTechnique }); setFiltersOpen(false) }}>Mostrar resultados</Button>
    </div></Modal>}
  </div>
}
