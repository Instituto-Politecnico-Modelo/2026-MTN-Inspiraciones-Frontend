// Publicaciones que el usuario ya vio en "Para vos", guardadas en este navegador.
// Se usan para mandar al final, al recargar, lo que ya se vio (más veces vista, más abajo).
const MAX_ENTRIES = 500

const keyFor = (userId: string) => `trama-vistas:${userId}`

export function readSeen(userId: string | undefined): Record<string, number> {
  if (!userId) return {}
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(userId)) ?? '{}') as unknown
    return raw && typeof raw === 'object' ? raw as Record<string, number> : {}
  } catch {
    return {}
  }
}

export function markSeen(userId: string, postId: string) {
  const seen = readSeen(userId)
  const views = (seen[postId] ?? 0) + 1
  delete seen[postId]
  seen[postId] = views
  const entries = Object.entries(seen)
  // Se conservan las más recientes: el orden de inserción refleja la última vez vista.
  const trimmed = entries.length > MAX_ENTRIES ? Object.fromEntries(entries.slice(-MAX_ENTRIES)) : seen
  try { localStorage.setItem(keyFor(userId), JSON.stringify(trimmed)) } catch { /* almacenamiento lleno o bloqueado */ }
}

/** Orden estable: primero lo no visto (en el orden recibido), después lo visto menos veces. */
export function sinkSeen<T extends { id: string }>(items: T[], seen: Record<string, number>): T[] {
  return items
    .map((item, index) => ({ item, index, views: seen[item.id] ?? 0 }))
    .sort((a, b) => a.views - b.views || a.index - b.index)
    .map(entry => entry.item)
}
