import { beforeEach, describe, expect, it } from 'vitest'
import { localeChoice } from '../../i18n'
import { activitySummary, groupToRows, toolStepLabel } from './activity'
import type { ChatItem } from './store'

// The labels are localized; lock the locale so the assertions are stable.
beforeEach(() => {
  localeChoice.set('es')
})

const user = (id = 'u1'): ChatItem => ({ kind: 'user', id, text: 'hola' })
const assistant = (id = 'a1', text = 'respuesta', extra: Partial<Extract<ChatItem, { kind: 'assistant' }>> = {}): ChatItem => ({
  kind: 'assistant', id, text, streaming: false, error: '', ...extra,
})
const tool = (id: string, name: string, extra: Partial<Extract<ChatItem, { kind: 'tool' }>> = {}): ChatItem => ({
  kind: 'tool', id, name, context: '', summary: '', durationS: null, done: true, ...extra,
})
const reasoning = (id = 'r1', text = 'pienso…', streaming = false): ChatItem => ({ kind: 'reasoning', id, text, streaming })

describe('toolStepLabel', () => {
  it('maps the common tools to friendly Spanish labels', () => {
    expect(toolStepLabel('terminal')).toBe('Usó la terminal')
    expect(toolStepLabel('browser_navigate')).toBe('Navegó')
    expect(toolStepLabel('browser_exec')).toBe('Navegó')
    expect(toolStepLabel('web_search')).toBe('Buscó en la web')
    expect(toolStepLabel('skill_view')).toBe('Leyó una habilidad')
    expect(toolStepLabel('computer_use')).toBe('Usó su computadora')
    expect(toolStepLabel('clarify')).toBe('Te preguntó')
  })

  it('hides the internal plumbing tools', () => {
    expect(toolStepLabel('tool_describe')).toBeNull()
    expect(toolStepLabel('tool_search')).toBeNull()
  })

  it('uses the first bridged label text for unknown tools', () => {
    const labels = [{ kind: 'tool' as const, app: 'gmail', action: 'send', emoji: '✉️', text: 'Envió un mail', name: 'gmail.send' }]
    expect(toolStepLabel('tool_call', labels)).toBe('Envió un mail')
    expect(toolStepLabel('unknown_tool', labels)).toBe('Envió un mail')
  })

  it('falls back to a generic line without labels', () => {
    expect(toolStepLabel('unknown_tool')).toBe('Usó una herramienta')
  })
})

describe('groupToRows', () => {
  it('groups a quiet working turn into one activity row above the answer', () => {
    const rows = groupToRows([
      user(),
      reasoning('r1', 'voy a buscar', false),
      tool('t1', 'terminal', { done: true, durationS: 2 }),
      tool('t2', 'web_search', { done: true, durationS: 4, summary: 'Did 2 searches' }),
      assistant(),
    ])
    expect(rows.map(r => r.kind)).toEqual(['item', 'activity', 'item'])
    const activity = rows[1]
    if (activity.kind !== 'activity') throw new Error('expected activity row')
    expect(activity.steps.map(s => s.label)).toEqual(['Razonamiento', 'Usó la terminal', 'Buscó en la web'])
    expect(activity.steps[0].reasoningText).toBe('voy a buscar')
    expect(activity.steps[2].detail).toContain('Did 2 searches')
  })

  it('keeps interim text segments in order with one activity row per tool burst', () => {
    const rows = groupToRows([
      user(),
      assistant('a1', 'empiezo'),
      tool('t1', 'terminal', {}),
      tool('t2', 'web_search', {}),
      assistant('a2', 'sigo'),
      tool('t3', 'browser_navigate', {}),
      assistant('a3', 'listo'),
    ])
    expect(rows.map(r => r.kind)).toEqual(['item', 'item', 'activity', 'item', 'activity', 'item'])
    expect(rows[0].kind === 'item' && rows[0].item.id).toBe('u1')
    expect(rows[1].kind === 'item' && rows[1].item.id).toBe('a1')
    expect(rows[3].kind === 'item' && rows[3].item.id).toBe('a2')
    expect(rows[5].kind === 'item' && rows[5].item.id).toBe('a3')
    if (rows[2].kind !== 'activity' || rows[4].kind !== 'activity') throw new Error('expected activity rows')
    expect(rows[2].steps.map(s => s.id)).toEqual(['t1', 't2'])
    expect(rows[4].steps.map(s => s.id)).toEqual(['t3'])
  })

  it('renders history the same way: done tools without durations, reasoning sidecars', () => {
    const rows = groupToRows([
      user('u-old'),
      reasoning('r-old', 'razonamiento viejo'),
      tool('t-old', 'terminal', { context: 'npm test', done: true, durationS: null }),
      assistant('a-old', 'resultado viejo'),
    ])
    expect(rows.map(r => r.kind)).toEqual(['item', 'activity', 'item'])
    if (rows[1].kind !== 'activity') throw new Error('expected activity row')
    expect(activitySummary(rows[1].steps).text).toBe('Listo · 2 pasos')
  })

  it('keeps the special cards outside activity rows', () => {
    const rows = groupToRows([
      user(),
      { kind: 'delivery', id: 'd1', target: 'otro-bot', reply: 'ok', pending: false },
      tool('t1', 'terminal', {}),
      assistant(),
    ])
    expect(rows.map(r => r.kind)).toEqual(['item', 'item', 'activity', 'item'])
    if (rows[1].kind !== 'item') throw new Error('expected delivery item row')
    expect(rows[1].item.kind).toBe('delivery')
  })

  it('supports an error turn: activity row completes, error stays a visible row', () => {
    const rows = groupToRows([
      user(),
      tool('t1', 'terminal', { done: true, durationS: 1.5 }),
      { kind: 'error', id: 'e1', text: 'falló' },
    ])
    expect(rows.map(r => r.kind)).toEqual(['item', 'activity', 'item'])
    if (rows[1].kind !== 'activity' || rows[2].kind !== 'item') throw new Error('expected activity + error rows')
    expect(activitySummary(rows[1].steps).text).toBe('Listo · 1 paso · 2 s')
    expect(rows[2].item.kind).toBe('error')
  })

  it('drops hidden tools and a burst of only-hidden tools produces no row', () => {
    const rows = groupToRows([
      user(),
      tool('h1', 'tool_describe', {}),
      assistant(),
      tool('h2', 'tool_search', {}),
      assistant('a2', 'fin'),
    ])
    expect(rows.map(r => r.kind)).toEqual(['item', 'item', 'item'])
  })

  it('keeps the row id stable while more steps stream in', () => {
    const first = groupToRows([user(), tool('t1', 'terminal', { done: false })])
    const second = groupToRows([user(), tool('t1', 'terminal', { done: false }), tool('t2', 'web_search', { done: false })])
    if (first[1].kind !== 'activity' || second[1].kind !== 'activity') throw new Error('expected activity rows')
    expect(first[1].id).toBe('t1')
    expect(second[1].id).toBe('t1')
  })

  it('drops empty reasoning steps and a streaming one keeps the row running', () => {
    const running = groupToRows([user(), reasoning('r1', '', true), tool('t1', 'terminal', { done: false })])
    if (running[1].kind !== 'activity') throw new Error('expected activity row')
    expect(running[1].steps.map(s => s.id)).toEqual(['t1'])
    expect(activitySummary(running[1].steps).running).toBe(true)

    const sealed = groupToRows([user(), reasoning('r1', '', false), tool('t1', 'terminal', { done: true, durationS: 1 })])
    if (sealed[1].kind !== 'activity') throw new Error('expected activity row')
    expect(sealed[1].steps.map(s => s.id)).toEqual(['t1'])
  })
})

describe('activitySummary', () => {
  const step = (done: boolean, durationS: number | null = null) => ({
    id: 's', kind: 'tool' as const, label: 'Usó la terminal', detail: '', durationS, done,
  })

  it('says Trabajando while any step is running', () => {
    expect(activitySummary([step(false), step(true, 2)]).text).toBe('Trabajando…')
    expect(activitySummary([step(true, 2)]).text).toBe('Listo · 1 paso · 2 s')
  })

  it('pluralizes and only shows seconds when durations exist', () => {
    expect(activitySummary([step(true), step(true)]).text).toBe('Listo · 2 pasos')
    expect(activitySummary([step(true, 0.4), step(true, 1.4)]).text).toBe('Listo · 2 pasos · 2 s')
  })
})
