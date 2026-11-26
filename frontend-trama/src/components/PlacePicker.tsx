import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Crosshair, Search, X } from 'lucide-react'
import type * as Leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MAP_TILE_ATTRIBUTION, MAP_TILES, validateCoordinates, type Coordinates } from '../data/places'
import { MAX_ADDRESS_LENGTH, MAX_LOCALITY_LENGTH, searchAddresses, type AddressMatch } from '../data/addressSearch'
import { Button, Field } from './UI'

type Engine = { L: typeof Leaflet; map: Leaflet.Map; marker?: Leaflet.Marker }
type SearchState =
  | { kind: 'idle' | 'loading' | 'empty' }
  | { kind: 'matches'; matches: AddressMatch[] }
  | { kind: 'error'; message: string }

export function PlacePicker({ value, onChange }: { value: Coordinates | null; onChange: (value: Coordinates | null) => void }) {
  const hintId = useId()
  const container = useRef<HTMLDivElement>(null)
  const engine = useRef<Engine | null>(null)
  const initialPlace = useRef(value)
  const change = useRef(onChange)
  const [ready, setReady] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [tileError, setTileError] = useState(false)
  const [street, setStreet] = useState('')
  const [locality, setLocality] = useState('')
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' })
  const [pickedAddress, setPickedAddress] = useState<AddressMatch | null>(null)
  const request = useRef<AbortController | null>(null)

  useEffect(() => { change.current = onChange }, [onChange])

  const resetSearch = useCallback(() => {
    request.current?.abort()
    request.current = null
    setSearch({ kind: 'idle' })
  }, [])

  const select = useCallback((point: Leaflet.LatLng) => {
    const { lat, lng } = point.wrap()
    if (validateCoordinates(lat, lng)) return
    resetSearch()
    setPickedAddress(null)
    change.current({ latitud: lat, longitud: lng })
  }, [resetSearch])

  function chooseAddress(match: AddressMatch) {
    const current = engine.current
    if (!current) return
    const { latitud, longitud } = match.location
    current.map.setView([latitud, longitud], match.approximate ? 16 : 18, { animate: false })
    setPickedAddress(match)
    setSearch({ kind: 'idle' })
    onChange(match.location)
  }

  async function findAddress() {
    if (!ready || !street.trim() || request.current) return
    const controller = new AbortController()
    request.current = controller
    setSearch({ kind: 'loading' })
    try {
      const matches = await searchAddresses(street, locality, controller.signal)
      if (controller.signal.aborted) return
      if (matches.length === 1) chooseAddress(matches[0])
      else if (matches.length > 1) setSearch({ kind: 'matches', matches })
      else setSearch({ kind: 'empty' })
    } catch {
      if (controller.signal.aborted) return
      setSearch({ kind: 'error', message: 'No se pudo buscar la dirección. Podés marcar el lugar en el mapa.' })
    } finally {
      if (request.current === controller) request.current = null
    }
  }

  function handleSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void findAddress()
    }
  }

  useEffect(() => {
    let active = true
    let map: Leaflet.Map | undefined
    void import('leaflet').then(({ default: L }) => {
      if (!active || !container.current) return
      const start = initialPlace.current
      map = L.map(container.current, { minZoom: 2, maxZoom: 19, zoomControl: false, scrollWheelZoom: false, worldCopyJump: true })
      map.setView(start ? [start.latitud, start.longitud] : [-37, -63.5], start ? 13 : 4)
      L.control.zoom({ zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map)
      L.tileLayer(MAP_TILES, { maxZoom: 19, attribution: MAP_TILE_ATTRIBUTION })
        .on('tileerror', () => { if (active) setTileError(true) })
        .on('tileload', () => { if (active) setTileError(false) })
        .addTo(map)
      map.on('click', (event: Leaflet.LeafletMouseEvent) => select(event.latlng))
      engine.current = { L, map }
      setReady(true)
    }).catch(() => { if (active) setMapError(true) })

    return () => {
      active = false
      request.current?.abort()
      request.current = null
      map?.remove()
      engine.current = null
    }
  }, [select])

  useEffect(() => {
    const current = engine.current
    if (!ready || !current) return
    if (!value) {
      current.marker?.remove()
      current.marker = undefined
      return
    }
    const point = current.L.latLng(value.latitud, value.longitud)
    if (current.marker) current.marker.setLatLng(point)
    else current.marker = current.L.marker(point, {
      icon: current.L.divIcon({ className: 'map-dot', iconSize: [20, 20] }),
      title: 'Lugar seleccionado',
      interactive: false,
      keyboard: false,
    }).addTo(current.map)
  }, [ready, value])

  return <fieldset className="place-fields">
    <legend>Lugar de inspiración (opcional)</legend>
    <div className="place-address-search">
      <div className="form-columns">
        <Field label="Calle y altura" value={street} placeholder="Av. de Mayo 575" maxLength={MAX_ADDRESS_LENGTH}
          onChange={event => { setStreet(event.target.value); resetSearch() }} onKeyDown={handleSearchKey} />
        <Field label="Ciudad o localidad (opcional)" value={locality} placeholder="CABA" maxLength={MAX_LOCALITY_LENGTH}
          onChange={event => { setLocality(event.target.value); resetSearch() }} onKeyDown={handleSearchKey} />
      </div>
      <div className="place-address-search-actions">
        <Button variant="secondary" disabled={!ready || !street.trim()} loading={search.kind === 'loading'} onClick={() => void findAddress()}>
          {search.kind !== 'loading' && <Search size={16} aria-hidden="true" />}Buscar dirección
        </Button>
        <p className="field-hint">Buscá en Argentina. La consulta se envía a <a href="https://www.argentina.gob.ar/georef">Georef</a>.</p>
      </div>
      <div aria-live="polite">
        {search.kind === 'empty' && <p className="field-hint">No encontramos un punto. Revisá la calle y la altura, agregá la ciudad o marcá el lugar en el mapa.</p>}
        {search.kind === 'error' && <p className="field-error" role="alert">{search.message}</p>}
        {search.kind === 'matches' && <>
          <p className="field-hint">Elegí la dirección que querés marcar.</p>
          <ul className="place-address-results" aria-label="Direcciones encontradas">
            {search.matches.map(match => <li key={`${match.location.latitud},${match.location.longitud}`}>
              <button type="button" className="map-entry" onClick={() => chooseAddress(match)}>
                {match.label}{match.approximate && <small>Punto aproximado en la calle</small>}
              </button>
            </li>)}
          </ul>
        </>}
      </div>
    </div>
    <p id={hintId} className="field-hint">Mové y acercá el mapa. Hacé clic o tocá el lugar que querés mostrar en tu publicación.</p>
    <div className="place-picker-map">
      <div ref={container} className="map-canvas" role="application" aria-label="Mapa para elegir el lugar" aria-describedby={hintId} />
      {ready && <Crosshair className="place-picker-center" size={24} aria-hidden="true" />}
    </div>
    {mapError && <p className="map-status" role="alert">No se pudo abrir el mapa. Podés publicar sin ubicación o volver a intentar recargando la página.</p>}
    {!mapError && tileError && <p className="map-status" role="alert">No se pudieron cargar partes del mapa. Revisá tu conexión.</p>}
    <div className="place-picker-actions">
      <p className="field-hint" role="status">{value ? 'Lugar seleccionado' : 'Sin ubicación'}
        {value && pickedAddress && <><br />{pickedAddress.label}{pickedAddress.approximate && ' (punto aproximado en la calle)'}</>}
      </p>
      <Button variant="secondary" disabled={!ready} onClick={() => {
        if (engine.current) select(engine.current.map.getCenter())
      }}>Marcar el centro</Button>
      {value && <Button variant="ghost" onClick={() => {
        resetSearch()
        setPickedAddress(null)
        onChange(null)
      }}><X size={16} aria-hidden="true" />Quitar ubicación</Button>}
    </div>
  </fieldset>
}
