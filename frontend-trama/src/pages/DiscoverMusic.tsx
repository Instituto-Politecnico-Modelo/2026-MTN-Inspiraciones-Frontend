import { useEffect, useState } from 'react'
import { musicalResources, type MusicCatalogItem, type MusicalResourceType } from '../data/api'
import { filtrarPorLicencia, opcionesLicenciaSonido, type FiltroLicenciaSonido } from '../data/licencias'
import { Button, EmptyState, ErrorMessage, SelectField } from '../components/UI'

const musicTypes = [{ value: 'cancion', label: 'Canciones' }, { value: 'sample', label: 'Sonidos' }]

export function DiscoverMusic({ query, type, onTypeChange }: {
  query: string; type: MusicalResourceType; onTypeChange: (type: MusicalResourceType) => void;
}) {
  const [licencia, setLicencia] = useState<FiltroLicenciaSonido>('todas')
  return <>
    <div className="filter-row"><SelectField label="Tipo de recurso musical" value={type} options={musicTypes}
      onChange={event => onTypeChange(event.target.value === 'sample' ? 'sample' : 'cancion')} />
    {type === 'sample' && <SelectField label="Licencia de los sonidos" value={licencia} options={opcionesLicenciaSonido}
      onChange={event => setLicencia(event.target.value as FiltroLicenciaSonido)} />}</div>
    <MusicResults key={`${type}:${query.trim()}`} query={query.trim()} type={type}
      licencia={type === 'sample' ? licencia : 'todas'} />
  </>
}

function MusicResults({ query, type, licencia }: { query: string; type: MusicalResourceType; licencia: FiltroLicenciaSonido }) {
  const [results, setResults] = useState<MusicCatalogItem[]>()
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (query.length === 1) return
    const request = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const rows = query ? await musicalResources.search(type, query, request.signal)
          : (await musicalResources.catalog(type, '', 1, request.signal)).items
        if (!Array.isArray(rows)) throw new Error('Respuesta incompleta')
        if (!request.signal.aborted) setResults(rows)
      } catch {
        if (!request.signal.aborted) setError(true)
      }
    }, query ? 300 : 0)
    return () => { window.clearTimeout(timer); request.abort() }
  }, [query, type, retry])

  if (query.length === 1) return <p role="status">Escribí al menos dos caracteres para buscar música.</p>
  if (error) return <div className="form-stack">
    <ErrorMessage message="No pudimos completar la búsqueda de música." />
    <Button variant="secondary" onClick={() => { setError(false); setRetry(value => value + 1) }}>Reintentar búsqueda</Button>
  </div>
  if (!results) return <p role="status">Buscando recursos musicales…</p>
  if (results.length === 0) return <EmptyState title="Todavía no encontramos coincidencias" description="Probá con otro título, artista o sonido." />
  const visibles = filtrarPorLicencia(results, licencia)
  if (visibles.length === 0) return <EmptyState title="Ningún sonido tiene esa licencia" description="Probá con otra licencia o quitá el filtro." />
  return <ul className="music-catalog-results" aria-label="Resultados musicales">
    {visibles.map(item => <li key={item.id} className="music-catalog-row">
      <div>
        <h2>{item.titulo}</h2>
        {item.artista && <p className="muted">{item.artista}</p>}
        {item.duracionSegundos != null && <p className="meta">{item.duracionSegundos} s</p>}
        {item.licencia && (/^https?:\/\/(www\.)?creativecommons\.org\//.test(item.licencia)
          ? <p className="meta"><a href={item.licencia} target="_blank" rel="noreferrer">Ver licencia</a></p>
          : <p className="meta">{item.licencia}</p>)}
      </div>
      {type === 'cancion' && item.artista && <SongLyrics item={item} />}
    </li>)}
  </ul>
}

function SongLyrics({ item }: { item: MusicCatalogItem }) {
  const [expanded, setExpanded] = useState(false)
  const [result, setResult] = useState<{ lyrics?: string; error?: boolean }>()
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!expanded || result) return
    const request = new AbortController()
    musicalResources.resolve({ tipoRecurso: 'cancion', titulo: item.titulo, artista: item.artista ?? '' }, request.signal)
      .then(song => { if (!request.signal.aborted) setResult({ lyrics: song.letraCompleta }) })
      .catch(() => { if (!request.signal.aborted) setResult({ error: true }) })
    return () => request.abort()
  }, [expanded, item, result, retry])

  return <div className="form-stack">
    <Button variant="secondary" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
      {expanded ? 'Ocultar letra' : `Ver letra de ${item.titulo}`}
    </Button>
    {expanded && (result?.error ? <>
      <ErrorMessage message="No pudimos consultar la letra." />
      <Button variant="secondary" onClick={() => { setResult(undefined); setRetry(value => value + 1) }}>Reintentar letra</Button>
    </> : !result ? <p role="status">Consultando letra…</p>
      : <p className="song-lyrics">{result.lyrics?.trim() || 'No hay una letra disponible para esta canción.'}</p>)}
  </div>
}
