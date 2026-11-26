import { useEffect, useId, useRef, useState } from 'react'
import { Crosshair, X } from 'lucide-react'
import type * as Leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MAP_TILE_ATTRIBUTION, MAP_TILES, validateCoordinates, type Coordinates } from '../data/places'
import { Button } from './UI'

type Engine = { L: typeof Leaflet; map: Leaflet.Map; marker?: Leaflet.Marker }

export function PlacePicker({ value, onChange }: { value: Coordinates | null; onChange: (value: Coordinates | null) => void }) {
  const hintId = useId()
  const container = useRef<HTMLDivElement>(null)
  const engine = useRef<Engine | null>(null)
  const initialPlace = useRef(value)
  const change = useRef(onChange)
  const [ready, setReady] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [tileError, setTileError] = useState(false)

  useEffect(() => { change.current = onChange }, [onChange])

  function select(point: Leaflet.LatLng) {
    const { lat, lng } = point.wrap()
    if (!validateCoordinates(lat, lng)) change.current({ latitud: lat, longitud: lng })
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
      map?.remove()
      engine.current = null
    }
  }, [])

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
    <p id={hintId} className="field-hint">Mové y acercá el mapa. Hacé clic o tocá el lugar que querés mostrar en tu publicación.</p>
    <div className="place-picker-map">
      <div ref={container} className="map-canvas" role="application" aria-label="Mapa para elegir el lugar" aria-describedby={hintId} />
      {ready && <Crosshair className="place-picker-center" size={24} aria-hidden="true" />}
    </div>
    {mapError && <p className="map-status" role="alert">No se pudo abrir el mapa. Podés publicar sin ubicación o volver a intentar recargando la página.</p>}
    {!mapError && tileError && <p className="map-status" role="alert">No se pudieron cargar partes del mapa. Revisá tu conexión.</p>}
    <div className="place-picker-actions">
      <p className="field-hint" role="status">{value ? 'Lugar seleccionado' : 'Sin ubicación'}</p>
      <Button variant="secondary" disabled={!ready} onClick={() => {
        if (engine.current) select(engine.current.map.getCenter())
      }}>Marcar el centro</Button>
      {value && <Button variant="ghost" onClick={() => onChange(null)}><X size={16} aria-hidden="true" />Quitar ubicación</Button>}
    </div>
  </fieldset>
}
