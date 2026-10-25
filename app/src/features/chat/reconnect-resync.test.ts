import { describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
const conn = vi.hoisted(() => ({ state: null as unknown as import('nanostores').WritableAtom<string> }))
vi.mock('../../lib/hermes/connection', async () => {
  const { atom } = await import('nanostores')
  conn.state = atom('open')
  return { request: rpc, on: vi.fn(), connectionState: conn.state }
})
vi.mock('../../lib/api', () => ({ apiFetch: vi.fn() }))
vi.mock('../../i18n', () => ({ t: (key: string) => key }))
vi.mock('../../lib/hermes/session-mutations', () => ({ setSessionUnread: vi.fn() }))
vi.mock('../home/busy-store', () => ({ registerBusySessionProfile: vi.fn() }))
vi.mock('../home/store', async () => {
  const { atom } = await import('nanostores')
  return { homeProfiles: atom([]), botDisplayName: vi.fn(), setVisibleProfile: vi.fn() }
})
vi.mock('./requests', () => ({ registerSessionProfile: vi.fn() }))

import { items, openChat, running } from './store'

describe('reconnect while a reply is running', () => {
  it('rejoins the chat and paints the reply that arrived while offline', async () => {
    rpc.mockImplementation(async (method: string) => {
      if (method === 'session.list') return { sessions: [{ id: 'stored' }] }
      if (method === 'session.resume') {
        return { session_id: 'rt-1', stored_session_id: 'stored', running: true, messages: [{ role: 'user', content: 'hola' }] }
      }
      return {}
    })
    await openChat('nico')
    expect(running.get()).toBe(true)

    // Phone drops the socket; the reply finishes on the server meanwhile.
    rpc.mockImplementation(async (method: string) =>
      method === 'session.resume'
        ? {
            session_id: 'rt-2',
            stored_session_id: 'stored',
            running: false,
            messages: [
              { role: 'user', content: 'hola' },
              { role: 'assistant', content: 'Llueve mañana.' },
            ],
          }
        : {},
    )
    conn.state.set('closed')
    conn.state.set('open')
    await vi.waitFor(() => expect(running.get()).toBe(false))

    expect(rpc).toHaveBeenCalledWith('session.resume', { session_id: 'stored', profile: 'nico' })
    expect(items.get().some(i => i.kind === 'assistant' && i.text.includes('Llueve'))).toBe(true)
  })
})
