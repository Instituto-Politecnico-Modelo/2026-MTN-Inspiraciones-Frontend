import { useCallback, useEffect, useState } from 'react'
import type { DevicePermission } from '../data/places'
import { devicePermission } from './geolocation'

// Vuelve a leer el permiso al volver a la aplicación, sin solicitarlo de nuevo (FR-014).
export function useDevicePermission(): [DevicePermission, () => void] {
  const [permission, setPermission] = useState<DevicePermission>('prompt')
  const refresh = useCallback(() => { void devicePermission().then(setPermission) }, [])
  useEffect(() => {
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [refresh])
  return [permission, refresh]
}
