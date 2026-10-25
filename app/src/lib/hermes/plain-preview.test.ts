import { describe, expect, it } from 'vitest'
import { plainPreview } from './bot-to-bot'

describe('plainPreview', () => {
  it('drops markdown markers and newlines', () => {
    expect(plainPreview('El servidor tiene **11 GiB** libres\n\n- `df -h`\n- [ver](https://x.y)')).toBe(
      'El servidor tiene 11 GiB libres df -h ver',
    )
  })
  it('keeps plain text as is', () => {
    expect(plainPreview('Listo.')).toBe('Listo.')
  })
})
