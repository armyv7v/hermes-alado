import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: { path: string; init?: RequestInit }[] = []
vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(async (path: string, init?: RequestInit) => {
    calls.push({ path, init })
    return {}
  }),
}))

import { createProfile } from './store'

describe('createProfile', () => {
  beforeEach(() => {
    calls.length = 0
  })

  it('gives a cloned bot its own identity instead of the source bot SOUL', async () => {
    await createProfile('lola')
    expect(calls[0].path).toBe('/api/profiles')
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({ name: 'lola', clone_from: 'default' })
    expect(calls[1].path).toBe('/api/profiles/lola/soul')
    const soul = JSON.parse(String(calls[1].init?.body)).content as string
    expect(soul).toContain('Lola')
    expect(soul).not.toMatch(/Pancho/)
  })

  it('leaves the SOUL alone when nothing is cloned', async () => {
    await createProfile('blank', { cloneFrom: null })
    expect(calls).toHaveLength(1)
  })
})
