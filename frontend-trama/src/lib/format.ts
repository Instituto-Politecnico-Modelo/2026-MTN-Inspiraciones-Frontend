const dateFormatter = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
export const formatDate = (value: string) => dateFormatter.format(new Date(value))
export const formatDateTime = (value: string) => new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(value))
export const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
export function relativeDate(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 86400000))
  return days === 0 ? 'Hoy' : days === 1 ? 'Ayer' : days < 7 ? `Hace ${days} días` : formatDate(value)
}
export const toLocalDateTime = (value: string) => new Date(Date.parse(value) - 3 * 3600000).toISOString().slice(0, 16)
export const fromLocalDateTime = (value: string) => new Date(`${value}:00-03:00`).toISOString()
export function safeReturnPath(value: string | null, fallback = '/inicio') {
  return value && /^\/(?!\/)/.test(value) && !value.includes('\\') && !/^\/(?:ingresar|registro|salir)(?:[/?]|$)/.test(value) ? value : fallback
}
export function backPath(state: unknown, fallback: string) {
  return typeof state === 'object' && state !== null && 'from' in state && typeof state.from === 'string'
    ? safeReturnPath(state.from, fallback) : fallback
}
