import { useEffect, useState, type FormEvent } from 'react'
import { musicalResources, type MusicalResource } from '../data/api'
import { Button, ErrorMessage, Field, SelectField } from './UI'

export function MusicInspirations({ postId, editable }: { postId: string; editable: boolean }) {
  const [items, setItems] = useState<MusicalResource[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [tipo, setTipo] = useState('cancion')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [soundId, setSoundId] = useState('')
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
      await musicalResources.link(postId, resource)
      setItems(current => [...current.filter(item => !(item.id === resource.id && item.tipoRecurso === resource.tipoRecurso)), resource])
      setTitle(''); setArtist(''); setSoundId('')
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo añadir la inspiración.') }
    finally { setPending(false) }
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
      {item.licencia && <p className="field-hint">Licencia: {item.licencia}</p>}
      {editable && <Button variant="secondary" disabled={pending} onClick={() => void remove(item)}>Quitar referencia</Button>}
    </li>)}</ul>
    {editable && <form className="form-stack" onSubmit={event => void add(event)}>
      <SelectField label="Añadir una referencia musical" value={tipo} disabled={pending} onChange={event => setTipo(event.target.value)} options={[{ value: 'cancion', label: 'Canción' }, { value: 'sample', label: 'Sonido de Freesound' }]} />
      {tipo === 'cancion' ? <><Field label="Título de la canción" value={title} onChange={event => setTitle(event.target.value)} required maxLength={255} disabled={pending} />
        <Field label="Artista de la canción" value={artist} onChange={event => setArtist(event.target.value)} required maxLength={255} disabled={pending} /></>
        : <Field label="Identificador del sonido en Freesound" type="number" min={1} step={1} value={soundId} onChange={event => setSoundId(event.target.value)} required disabled={pending} hint="El número que aparece en la página del sonido de Freesound." />}
      <Button type="submit" loading={pending}>Consultar y añadir inspiración</Button>
    </form>}
    <ErrorMessage message={error} />
  </section>
}
