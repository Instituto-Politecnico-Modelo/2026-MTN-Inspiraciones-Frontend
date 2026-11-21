import { useSearchParams } from 'react-router-dom'
import { LocationSettings } from '../components/LocationPreference'
import { PageTitle } from '../components/UI'
import { placesApi } from '../data/api'
import { getPosition } from '../lib/geolocation'
import { useDevicePermission } from '../lib/useDevicePermission'

export function LocationSettingsPage() {
  const [params] = useSearchParams()
  const back = params.get('desde') === 'inicio' ? { to: '/inicio?vista=mapa', label: 'Volver al mapa de Inicio' }
    : { to: '/descubrir?mapa=1', label: 'Volver al mapa' }
  const [permission, refresh] = useDevicePermission()
  // Pedirlo desde un botón es una acción del usuario; la app nunca lo solicita sola.
  const requestPermission = async () => { await getPosition().catch(() => undefined); refresh() }
  return <>
    <PageTitle title="Configuración de ubicación" description="Decidí si querés ver lugares cerca tuyo." back={back} />
    <LocationSettings api={placesApi} permission={permission} requestPermission={requestPermission} />
  </>
}
