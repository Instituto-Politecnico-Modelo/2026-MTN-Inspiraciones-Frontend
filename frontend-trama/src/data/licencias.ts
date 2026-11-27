import type { MusicCatalogItem } from './api'

export type FiltroLicenciaSonido = 'todas' | 'cc0' | 'cc-by'

export const opcionesLicenciaSonido = [
  { value: 'todas', label: 'Todas las licencias' },
  { value: 'cc0', label: 'CC0 (dominio público)' },
  { value: 'cc-by', label: 'CC BY (atribución)' },
]

// Acepta tanto la URL de Creative Commons como el nombre textual de la licencia.
// CC BY-SA, CC BY-NC y similares no entran en "cc-by".
export function licenciaSonido(licencia?: string | null): Exclude<FiltroLicenciaSonido, 'todas'> | 'otra' {
  if (!licencia) return 'otra'
  if (/\bCC0\b|creativecommons\.org\/publicdomain\/zero\//i.test(licencia)) return 'cc0'
  if (/\bCC BY\b(?!-)|creativecommons\.org\/licenses\/by\/\d/i.test(licencia)) return 'cc-by'
  return 'otra'
}

export function filtrarPorLicencia<T extends Pick<MusicCatalogItem, 'licencia'>>(items: T[], filtro: FiltroLicenciaSonido): T[] {
  return filtro === 'todas' ? items : items.filter(item => licenciaSonido(item.licencia) === filtro)
}
