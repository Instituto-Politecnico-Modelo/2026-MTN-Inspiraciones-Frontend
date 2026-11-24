import { beforeEach, describe, expect, it } from 'vitest'
import { markSeen, readSeen, sinkSeen } from './seenPosts'

beforeEach(() => localStorage.clear())

describe('publicaciones vistas', () => {
  it('manda al final lo visto, más abajo lo visto más veces, sin desordenar lo no visto', () => {
    markSeen('mora', 'a')
    markSeen('mora', 'a')
    markSeen('mora', 'c')
    const items = ['a', 'b', 'c', 'd'].map(id => ({ id }))

    expect(sinkSeen(items, readSeen('mora')).map(item => item.id)).toEqual(['b', 'd', 'c', 'a'])
  })

  it('separa lo visto por usuario', () => {
    markSeen('mora', 'a')
    expect(readSeen('lara')).toEqual({})
    expect(readSeen(undefined)).toEqual({})
  })
})
