import { describe, expect, it } from 'vitest'
import { filtrarPorLicencia, licenciaSonido } from './licencias'

describe('licenciaSonido', () => {
  it('reconoce CC0 y CC BY tanto por URL como por texto, y excluye variantes con otras condiciones', () => {
    expect(licenciaSonido('https://creativecommons.org/publicdomain/zero/1.0/')).toBe('cc0')
    expect(licenciaSonido('CC0')).toBe('cc0')
    expect(licenciaSonido('https://creativecommons.org/licenses/by/4.0/')).toBe('cc-by')
    expect(licenciaSonido('CC BY 4.0')).toBe('cc-by')
    expect(licenciaSonido('https://creativecommons.org/licenses/by-sa/4.0/')).toBe('otra')
    expect(licenciaSonido('CC BY-NC 4.0')).toBe('otra')
    expect(licenciaSonido(null)).toBe('otra')
  })

  it('filtra por licencia y deja todo cuando el filtro es "todas"', () => {
    const items = [{ licencia: 'CC0' }, { licencia: 'CC BY 4.0' }, { licencia: null }]
    expect(filtrarPorLicencia(items, 'todas')).toHaveLength(3)
    expect(filtrarPorLicencia(items, 'cc0')).toEqual([{ licencia: 'CC0' }])
  })
})
