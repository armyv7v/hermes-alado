import { describe, expect, it } from 'vitest'
import { handleFor } from './group-handles'

describe('handleFor', () => {
  it('uses the visible bot name, not the internal profile id', () => {
    expect(handleFor({ profile: 'prueba', displayName: 'Tomi' })).toBe('tomi')
    expect(handleFor({ profile: 'default', displayName: 'Pancho' })).toBe('pancho')
  })
  it('drops accents and characters the mention parser rejects', () => {
    expect(handleFor({ profile: 'x', displayName: 'Inés Pérez' })).toBe('inesperez')
  })
  it('falls back to the profile for reserved or empty names', () => {
    expect(handleFor({ profile: 'bot1', displayName: 'All' })).toBe('bot1')
    expect(handleFor({ profile: 'bot2' })).toBe('bot2')
  })
})
