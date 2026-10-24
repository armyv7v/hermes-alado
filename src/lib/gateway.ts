import { apiFetch } from './api'
import { wsUrl } from './config'

export type GatewayEvent = {
  type: string
  session_id?: string
  payload?: Record<string, unknown>
  [key: string]: unknown
}

type EventHandler = (event: GatewayEvent) => void
type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void }

/**
 * Minimal JSON-RPC client over the Hermes gateway WebSocket (`/api/ws`),
 * the same transport the Desktop app uses. Auth via a single-use ticket.
 */
export class GatewayClient {
  private ws: WebSocket | null = null
  private nextId = 1
  private pending = new Map<number, Pending>()
  private handlers = new Set<EventHandler>()

  async connect(): Promise<void> {
    const { ticket } = await apiFetch<{ ticket: string }>('/api/auth/ws-ticket', { method: 'POST' })
    const base = wsUrl('/api/ws')
    const url = `${base}?ticket=${encodeURIComponent(ticket)}`
    await this.open(url)
  }

  private open(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url)
      this.ws = ws
      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error('No se pudo conectar al gateway de Hermes'))
      ws.onclose = () => {
        if (this.ws === ws) this.ws = null
      }
      ws.onmessage = (ev) => this.handleMessage(ev.data)
    })
  }

  onEvent(handler: EventHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  request<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Gateway no conectado'))
        return
      }
      const id = this.nextId++
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
      })
      this.ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
    })
  }

  send(method: string, params: Record<string, unknown> = {}): void {
    this.ws?.send(JSON.stringify({ jsonrpc: '2.0', method, params }))
  }

  private handleMessage(raw: unknown): void {
    let frame: {
      id?: number | null
      result?: unknown
      error?: { message?: string }
      method?: string
      params?: GatewayEvent
    }
    try {
      frame = JSON.parse(String(raw))
    } catch {
      return
    }

    if (frame.id != null) {
      const p = this.pending.get(frame.id)
      if (p) {
        this.pending.delete(frame.id)
        if (frame.error) p.reject(new Error(frame.error.message ?? 'RPC error'))
        else p.resolve(frame.result)
      }
      return
    }

    if (frame.method === 'event' && frame.params?.type) {
      const event = frame.params as GatewayEvent
      this.handlers.forEach((h) => h(event))
    }
  }

  close(): void {
    this.ws?.close()
    this.ws = null
    this.pending.forEach((p) => p.reject(new Error('Gateway cerrado')))
    this.pending.clear()
  }
}
