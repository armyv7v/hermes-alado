import { beforeEach, describe, expect, it, vi } from 'vitest'
import { atom } from 'nanostores'
import { JsonRpcGatewayError } from '../../lib/hermes/vendor/json-rpc-channel'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../lib/hermes/connection', () => ({ request: rpc, on: vi.fn() }))
vi.mock('../../lib/api', () => ({ apiFetch: vi.fn() }))
vi.mock('../../i18n', () => ({ t: (key: string) => key }))
vi.mock('../../lib/hermes/session-mutations', () => ({ setSessionUnread: vi.fn() }))
vi.mock('../home/busy-store', () => ({ registerBusySessionProfile: vi.fn() }))
vi.mock('../home/store', () => ({
  homeProfiles: atom([]), botDisplayName: vi.fn(), setVisibleProfile: vi.fn(),
}))
vi.mock('./requests', () => ({ registerSessionProfile: vi.fn() }))

import { closeChat, items, openChat, running, sendMessage } from './store'

beforeEach(() => {
  closeChat()
  rpc.mockReset()
  rpc.mockImplementation(async (method: string) => {
    if (method === 'session.list') return { sessions: [{ id: 'stored-chat' }] }
    if (method === 'session.resume') return { session_id: 'old-runtime', stored_session_id: 'stored-chat', messages: [] }
    return {}
  })
})

describe('sending after a mobile reconnect', () => {
  it('resumes the saved conversation and retries once without duplicating the message', async () => {
    await openChat('informes')
    rpc.mockClear()
    rpc.mockImplementation(async (method: string, params: { session_id?: string }) => {
      if (method === 'prompt.submit' && params.session_id === 'old-runtime') {
        throw new JsonRpcGatewayError('session not found', { code: 4001 })
      }
      if (method === 'session.resume') return { session_id: 'new-runtime', stored_session_id: 'stored-chat' }
      return {}
    })
    await sendMessage('Preparar el informe')
    expect(rpc.mock.calls).toEqual([
      ['prompt.submit', { session_id: 'old-runtime', text: 'Preparar el informe' }],
      ['session.resume', { session_id: 'stored-chat', profile: 'informes' }],
      ['prompt.submit', { session_id: 'new-runtime', text: 'Preparar el informe' }],
    ])
    expect(items.get().filter(item => item.kind === 'user')).toHaveLength(1)
    expect(items.get().some(item => item.kind === 'error')).toBe(false)
  })

  it('does not retry an ambiguous network failure that might have admitted the prompt', async () => {
    await openChat('informes')
    rpc.mockClear()
    rpc.mockRejectedValue(new Error('connection lost'))
    await sendMessage('Preparar el informe')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(running.get()).toBe(false)
  })

  it('does not submit the recovered prompt after the user closes the chat', async () => {
    await openChat('informes')
    rpc.mockImplementation(async (method: string) => {
      if (method === 'prompt.submit') throw new JsonRpcGatewayError('session not found', { code: 4001 })
      closeChat()
      return { session_id: 'new-runtime' }
    })
    await sendMessage('Preparar el informe')
    expect(items.get()).toEqual([])
  })
})
