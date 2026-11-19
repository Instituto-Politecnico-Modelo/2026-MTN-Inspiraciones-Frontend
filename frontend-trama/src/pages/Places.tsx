import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlacesExplorer } from '../components/PlacesExplorer'
import { RequireAccount } from '../components/Shell'
import { PageTitle } from '../components/UI'
import { placesApi } from '../data/api'
import { proximityAccess, type LocationPreference } from '../data/places'
import { getPosition } from '../lib/geolocation'
import { useDevicePermission } from '../lib/useDevicePermission'

function PlacesContent() {
  const [preference, setPreference] = useState<LocationPreference>(null)
  const [permission] = useDevicePermission()
  useEffect(() => {
    let active = true
    placesApi.preference.get().then(value => { if (active) setPreference(value) }).catch(() => undefined)
    return () => { active = false }
  }, [])
  return <>
    <PageTitle title="Mapa de lugares" description="Explorá las obras que nacieron en un lugar y encontrá inspiración cerca tuyo."
      actions={<Link className="button button-secondary" to="/ubicacion/configuracion">Configuración de ubicación</Link>} />
    <PlacesExplorer api={placesApi} access={proximityAccess(preference, permission)} getPosition={getPosition} />
  </>
}

export const PlacesPage = () => <RequireAccount><PlacesContent /></RequireAccount>
