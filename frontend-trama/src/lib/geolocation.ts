import type { Coordinates, DevicePermission } from '../data/places'

// La posición se usa solo para la consulta en curso: no se guarda ni se registra (NFR-004).
export function getPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Este navegador no permite obtener tu ubicación.')); return }
    navigator.geolocation.getCurrentPosition(
      position => resolve({ latitud: position.coords.latitude, longitud: position.coords.longitude }),
      () => reject(new Error('No pudimos obtener tu ubicación. Revisá el permiso del dispositivo.')),
      { maximumAge: 60_000, timeout: 10_000 },
    )
  })
}

// Consultar el estado del permiso no abre el aviso del navegador.
export async function devicePermission(): Promise<DevicePermission> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return 'unsupported'
  try { return (await navigator.permissions.query({ name: 'geolocation' })).state } catch { return 'prompt' }
}
