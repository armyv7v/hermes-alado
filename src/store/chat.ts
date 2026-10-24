import { atom } from 'nanostores'
import { GatewayClient, type GatewayEvent } from '../lib/gateway'

export type ChatMsg = {
  role: 'user' | 'assistant'
  text: string
  pending?: boolean
}

export const messages = atom<ChatMsg[]>([])
export const thinking = atom<boolean>(false)
export const pendingConfirm = atom<string>('')

let client: GatewayClient | null = null
let sessionId: string | null = null
let currentProfile: string | null = null

export function chatProfile(): string | null {
  return currentProfile
}

export async function connectChat(profile: string): Promise<void> {
  if (client) client.close()
  client = new GatewayClient()
  sessionId = null
  currentProfile = profile
  messages.set([])
  pendingConfirm.set('')
  thinking.set(false)

  client.onEvent(handleEvent)
  await client.connect()

  const params: Record<string, unknown> = { source: 'web' }
  if (profile !== 'default') params.profile = profile
  const result = await client.request<{ session_id?: string }>('session.create', params)
  sessionId = result.session_id ?? null
}

export function disconnectChat(): void {
  client?.close()
  client = null
  sessionId = null
  currentProfile = null
}

export function sendMessage(text: string): void {
  const trimmed = text.trim()
  if (!trimmed) return
  if (!client || !sessionId) return

  const list = messages.get()
  messages.set([
    ...list,
    { role: 'user', text: trimmed },
    { role: 'assistant', text: '', pending: true },
  ])
  thinking.set(true)
  client.request('prompt.submit', { session_id: sessionId, text: trimmed }).catch(() => {})
}

export function cancelMessage(): void {
  if (!client || !sessionId) return
  client.request('session.interrupt', { session_id: sessionId }).catch(() => {})
}

export function confirmPending(): void {
  // Approval flow: minimal for now — the confirm button just clears the state.
  pendingConfirm.set('')
}

function handleEvent(e: GatewayEvent): void {
  if (e.session_id && sessionId && e.session_id !== sessionId) return

  const list = messages.get()

  if (e.type === 'message.start') {
    thinking.set(true)
    return
  }

  if (e.type === 'message.delta') {
    const text = typeof e.payload?.text === 'string' ? e.payload.text : ''
    if (!text) return
    const next = replaceLastAssistant(list, (m) => ({
      ...m,
      text: m.text + text,
      pending: true,
    }))
    messages.set(next)
    thinking.set(true)
    return
  }

  if (e.type === 'message.complete') {
    const final = typeof e.payload?.text === 'string' ? e.payload.text : ''
    const next = replaceLastAssistant(list, (m) => ({
      ...m,
      text: final && !m.text ? final : m.text,
      pending: false,
    }))
    messages.set(next)
    thinking.set(false)
    return
  }

  if (e.type === 'tool.start' || e.type === 'tool.progress' || e.type === 'tool.complete') {
    thinking.set(true)
    return
  }

  if (e.type === 'approval.request') {
    thinking.set(false)
    pendingConfirm.set('pendiente')
    return
  }

  if (e.type === 'error') {
    const text =
      typeof e.payload?.text === 'string'
        ? e.payload.text
        : typeof e.payload?.message === 'string'
          ? e.payload.message
          : ''
    const next = replaceLastAssistant(list, (m) => ({
      ...m,
      text: m.text ? `${m.text}\n⚠ ${text || 'error'}` : `⚠ ${text || 'error'}`,
      pending: false,
    }))
    messages.set(next)
    thinking.set(false)
    return
  }
}

function replaceLastAssistant(list: ChatMsg[], fn: (m: ChatMsg) => ChatMsg): ChatMsg[] {
  const idx = list.length - 1
  if (idx < 0 || list[idx].role !== 'assistant') return list
  return list.map((m, i) => (i === idx ? fn(m) : m))
}
