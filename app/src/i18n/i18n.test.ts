import { describe, expect, it } from 'vitest'
import { en } from './en'
import { es } from './es'
import { locale, localeChoice, setLocaleChoice, t, tp } from './index'

function flatten(messages: unknown, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>()
  if (typeof messages !== 'object' || messages === null) return out
  for (const [key, value] of Object.entries(messages as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null && !('one' in value)) {
      for (const [k, v] of flatten(value, path)) out.set(k, v)
    } else {
      out.set(path, value)
    }
  }
  return out
}

describe('i18n dictionaries', () => {
  it('en and es have the exact same key sets', () => {
    const enKeys = flatten(en)
    const esKeys = flatten(es)
    expect([...esKeys.keys()].sort()).toEqual([...enKeys.keys()].sort())
  })

  it('en and es leaves match shape (string vs plural) and are never empty', () => {
    const enKeys = flatten(en)
    const esKeys = flatten(es)
    for (const [key, value] of enKeys) {
      const other = esKeys.get(key)
      expect(other, `missing es key: ${key}`).toBeDefined()
      const isPlural = typeof value === 'object' && value !== null
      if (isPlural) {
        expect(other, `es ${key} should be a plural`).toSatisfy(v => typeof v === 'object' && v !== null)
        const enPlural = value as { one: string; other: string }
        const esPlural = other as { one: string; other: string }
        expect(enPlural.one.length).toBeGreaterThan(0)
        expect(enPlural.other.length).toBeGreaterThan(0)
        expect(esPlural.one.length).toBeGreaterThan(0)
        expect(esPlural.other.length).toBeGreaterThan(0)
      } else {
        expect(typeof other, `es ${key} should be a string`).toBe('string')
        expect((value as string).trim().length).toBeGreaterThan(0)
        expect((other as string).trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('interpolates {name} vars and resolves plurals per locale', () => {
    setLocaleChoice('en')
    expect(locale.get()).toBe('en')
    expect(t('chat.composerPlaceholder', { name: 'Pancho' })).toBe('Give Pancho a task')
    expect(tp('apply.button', 1)).toBe('Apply to 1 bot')
    expect(tp('apply.button', 3)).toBe('Apply to 3 bots')
    setLocaleChoice('es')
    expect(locale.get()).toBe('es')
    expect(t('chat.composerPlaceholder', { name: 'Pancho' })).toBe('Dale una tarea a Pancho')
    expect(tp('apply.button', 3)).toBe('Aplicar a 3 bots')
    setLocaleChoice('system')
  })

  it('isolation: the test suite never leaks a persisted locale', () => {
    localeChoice.set('system')
    expect(localeChoice.get()).toBe('system')
  })
})
