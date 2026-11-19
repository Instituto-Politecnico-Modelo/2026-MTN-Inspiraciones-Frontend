import { describe, expect, it } from 'vitest'
import {
  MAX_OWN_TAGS, MAX_RADIUS_KM, mergeById, normalizeOwnTags, proximityAccess, techniquesFor, validateCoordinates, validateRadius,
  type CatalogDiscipline,
} from './places'

const catalog: CatalogDiscipline[] = [
  { codigo: 'ILUSTRACION', nombre: 'Ilustración', tecnicas: [{ codigo: 'ILUSTRACION_DIGITAL', nombre: 'digital' }, { codigo: 'ILUSTRACION_TRADICIONAL', nombre: 'tradicional' }] },
  { codigo: 'PINTURA', nombre: 'Pintura', tecnicas: [{ codigo: 'PINTURA_ACUARELA', nombre: 'acuarela' }, { codigo: 'PINTURA_GUACHE', nombre: 'guache' }, { codigo: 'PINTURA_GRAFITO', nombre: 'grafito' }] },
  { codigo: 'COLLAGE', nombre: 'Collage', tecnicas: [{ codigo: 'COLLAGE_ANALOGICO', nombre: 'analógico' }, { codigo: 'COLLAGE_DIGITAL', nombre: 'digital' }] },
]

describe('tags propios (FR-015/016)', () => {
  it('admite de cero a tres tags', () => {
    expect(MAX_OWN_TAGS).toBe(3)
    expect(normalizeOwnTags([])).toEqual({ tags: [], error: '' })
    expect(normalizeOwnTags(['mar', 'faro', 'playa']).tags).toEqual(['mar', 'faro', 'playa'])
  })

  it('rechaza el cuarto tag sin superar el límite', () => {
    const result = normalizeOwnTags(['a', 'b', 'c', 'd'])
    expect(result.error).toMatch(/hasta 3/)
    expect(result.tags).toHaveLength(3)
  })

  it('normaliza con recorte y minúsculas y no repite equivalentes', () => {
    expect(normalizeOwnTags(['  Mar ', 'MAR', 'mar']).tags).toEqual(['mar'])
  })

  it('descarta vacíos y rechaza más de 100 caracteres', () => {
    expect(normalizeOwnTags(['  ', 'faro']).tags).toEqual(['faro'])
    expect(normalizeOwnTags(['x'.repeat(101)]).error).toMatch(/100/)
  })
})

describe('radio de distancia (FR-007)', () => {
  it('acepta mayor que cero hasta 100 km inclusive', () => {
    expect(MAX_RADIUS_KM).toBe(100)
    expect(validateRadius(0.5)).toBe('')
    expect(validateRadius(100)).toBe('')
  })

  it.each([0, -1, 100.1, Number.NaN, Number.POSITIVE_INFINITY])('rechaza %s', value => {
    expect(validateRadius(value)).not.toBe('')
  })
})

describe('coordenadas de la publicación (FR-003)', () => {
  it('acepta los límites inclusivos y rechaza fuera de rango o no numéricas', () => {
    expect(validateCoordinates(-90, 180)).toBe('')
    expect(validateCoordinates(90, -180)).toBe('')
    expect(validateCoordinates(91, 0)).toMatch(/latitud/i)
    expect(validateCoordinates(0, -181)).toMatch(/longitud/i)
    expect(validateCoordinates(Number.NaN, 0)).not.toBe('')
  })
})

describe('técnicas dependientes de la disciplina (FR-018/019)', () => {
  it('ofrece solo las técnicas de la disciplina elegida', () => {
    expect(techniquesFor(catalog, 'PINTURA').map(item => item.nombre)).toEqual(['acuarela', 'guache', 'grafito'])
    expect(techniquesFor(catalog, 'INEXISTENTE')).toEqual([])
  })

  it('distingue técnicas homónimas por su pareja disciplina-técnica', () => {
    expect(techniquesFor(catalog, 'ILUSTRACION').find(item => item.nombre === 'digital')?.codigo).toBe('ILUSTRACION_DIGITAL')
    expect(techniquesFor(catalog, 'COLLAGE').find(item => item.nombre === 'digital')?.codigo).toBe('COLLAGE_DIGITAL')
  })
})

describe('acceso a la cercanía (FR-010-014)', () => {
  it('se habilita solo con preferencia activada y permiso concedido', () => {
    expect(proximityAccess('ACTIVADA', 'granted')).toEqual({ enabled: true, reason: 'ok' })
  })

  it('conserva la preferencia activada pero deshabilita con permiso denegado', () => {
    expect(proximityAccess('ACTIVADA', 'denied')).toEqual({ enabled: false, reason: 'permiso-denegado' })
    expect(proximityAccess('ACTIVADA', 'unsupported')).toEqual({ enabled: false, reason: 'sin-soporte' })
  })

  it('no usa la ubicación con preferencia desactivada aunque el dispositivo conceda permiso', () => {
    expect(proximityAccess('DESACTIVADA', 'granted')).toEqual({ enabled: false, reason: 'desactivada' })
  })

  it('sin decisión no usa la ubicación ni solicita permiso', () => {
    expect(proximityAccess('PENDIENTE', 'prompt')).toEqual({ enabled: false, reason: 'sin-decision' })
    expect(proximityAccess(null, 'granted')).toEqual({ enabled: false, reason: 'sin-decision' })
  })
})

describe('paginación sin repetidos (FR-009)', () => {
  it('descarta publicaciones ya mostradas aunque cambien de posición entre páginas', () => {
    const shown = [{ id: 'a' }, { id: 'b' }]
    expect(mergeById(shown, [{ id: 'b' }, { id: 'c' }]).map(item => item.id)).toEqual(['a', 'b', 'c'])
  })
})
