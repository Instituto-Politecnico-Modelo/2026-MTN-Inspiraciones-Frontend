import { useEffect, useRef, useState } from 'react'
import type * as Leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { boundsToZone, publicationText, type Coordinates, type Zone } from '../data/places'

export type MapItem = { publicacion: { id: string; contenido?: string; ubicacion?: Coordinates | null }; distanciaKm?: number }
type Props = {
  items: MapItem[]
  selectedId: string | null
  focus?: { center: Coordinates; radiusKm: number } | null
  onSelect: (id: string) => void
  onViewChange: (zone: Zone) => void
  onUnavailable: () => void
}

const TILES = import.meta.env.VITE_MAP_TILES_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
type Engine = { L: typeof Leaflet; map: Leaflet.Map; group: Leaflet.MarkerClusterGroup; markers: Map<string, Leaflet.Marker>; quiet: { value: boolean } }

const dot = (L: typeof Leaflet, selected: boolean) => L.divIcon({ className: selected ? 'map-dot is-selected' : 'map-dot', iconSize: [20, 20] })

export function MapView({ items, selectedId, focus, onSelect, onViewChange, onUnavailable }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const engine = useRef<Engine | null>(null)
  const callbacks = useRef({ onSelect, onViewChange, onUnavailable })
  const [ready, setReady] = useState(false)
  useEffect(() => { callbacks.current = { onSelect, onViewChange, onUnavailable } })

  useEffect(() => {
    let disposed = false
    let dispose = () => {}
    void (async () => {
      try {
        const L = (await import('leaflet')).default
        ;(window as unknown as { L: typeof L }).L = L
        await import('leaflet.markercluster')
        if (disposed || !container.current) return
        const map = L.map(container.current, { worldCopyJump: true, minZoom: 2 }).setView([20, 0], 2)
        let failed = false
        L.tileLayer(TILES, { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map)
          .on('tileerror', () => { if (!failed) { failed = true; callbacks.current.onUnavailable() } })
        const group = L.markerClusterGroup({ spiderfyOnMaxZoom: true, showCoverageOnHover: false })
        map.addLayer(group)
        const quiet = { value: false }
        map.on('moveend', () => {
          if (quiet.value) { quiet.value = false; return }
          const bounds = map.getBounds()
          callbacks.current.onViewChange(boundsToZone({ south: bounds.getSouth(), north: bounds.getNorth(), west: bounds.getWest(), east: bounds.getEast() }))
        })
        engine.current = { L, map, group, markers: new Map(), quiet }
        dispose = () => { map.remove(); engine.current = null }
        setReady(true)
      } catch { callbacks.current.onUnavailable() }
    })()
    return () => { disposed = true; dispose() }
  }, [])

  useEffect(() => {
    const current = engine.current
    if (!ready || !current) return
    const { L, group, markers } = current
    group.clearLayers()
    markers.clear()
    for (const item of items) {
      const place = item.publicacion.ubicacion
      if (!place) continue
      const marker = L.marker([place.latitud, place.longitud], { icon: dot(L, false), title: publicationText(item.publicacion.contenido ?? '').title, keyboard: true })
      marker.on('click', () => callbacks.current.onSelect(item.publicacion.id))
      markers.set(item.publicacion.id, marker)
      group.addLayer(marker)
    }
  }, [items, ready])

  useEffect(() => {
    const current = engine.current
    if (!ready || !current) return
    current.markers.forEach((marker, id) => marker.setIcon(dot(current.L, id === selectedId)))
    const marker = selectedId ? current.markers.get(selectedId) : undefined
    if (!marker) return
    // Centrar es un movimiento propio: no debe recargar la lista como si el usuario hubiera movido el mapa.
    current.quiet.value = true
    current.map.setView(marker.getLatLng(), Math.max(current.map.getZoom(), 13), { animate: false })
    current.quiet.value = false
    current.group.zoomToShowLayer(marker)
  }, [selectedId, ready])

  useEffect(() => {
    const current = engine.current
    if (!ready || !current || !focus) return
    // Ajustar la vista al radio es un movimiento propio: no debe disparar una consulta por zona.
    current.quiet.value = true
    current.map.fitBounds(current.L.latLng(focus.center.latitud, focus.center.longitud).toBounds(focus.radiusKm * 2000), { animate: false })
    current.quiet.value = false
  }, [focus, ready])

  return <div ref={container} className="map-canvas" role="application" aria-label="Mapa de lugares de inspiración" />
}
