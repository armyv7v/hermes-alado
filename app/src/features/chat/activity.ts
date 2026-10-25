import { t, tp } from '../../i18n'
import type { ToolLabel } from '../../lib/hermes/rpc-types'
import type { ChatItem } from './store'

// ── friendly tool labels ─────────────────────────────────────────────────────
//
// The chat is quiet by design (Product principle): tool calls never show their
// raw ids or raw argument JSON. Each step gets a friendly label from the tool
// name, falling back to the human `labels[0].text` the gateway sends for
// bridged calls (tui_gateway/tool_progress.py `_tool_labels`), or a generic
// line for tools we have never heard of. Labels are localized via i18n.

const HIDDEN_TOOLS = new Set(['tool_describe', 'tool_search'])

const KNOWN_LABEL_KEYS: Record<string, 'chat.activity.terminal' | 'chat.activity.webSearch' | 'chat.activity.skillView' | 'chat.activity.computerUse' | 'chat.activity.clarify'> = {
  terminal: 'chat.activity.terminal',
  web_search: 'chat.activity.webSearch',
  skill_view: 'chat.activity.skillView',
  computer_use: 'chat.activity.computerUse',
  clarify: 'chat.activity.clarify',
}

/** Friendly step label for a tool, or `null` when the call is internal plumbing and must not render. */
export function toolStepLabel(name: string, labels?: ToolLabel[] | null): string | null {
  if (HIDDEN_TOOLS.has(name)) return null
  const known = KNOWN_LABEL_KEYS[name]
  if (known) return t(known)
  if (name.startsWith('browser_')) return t('chat.activity.browser')
  const first = labels?.[0]
  if (first?.text) return first.text
  return t('chat.activity.tool')
}

// ── rows ─────────────────────────────────────────────────────────────────────
//
// One activity row per run of tool + reasoning items between text items (user /
// agent / delivery / assistant / error). A turn that works silently produces a
// single row above the final answer; interim text segments stay in place and
// each tool burst between them gets its own row.

export interface ActivityStep {
  id: string
  kind: 'tool' | 'reasoning'
  label: string
  detail: string
  durationS: number | null
  done: boolean
  reasoningText?: string
}

export type ChatRow =
  | { kind: 'item'; item: ChatItem }
  | { kind: 'activity'; id: string; steps: ActivityStep[] }

function toolDetail(context: string, summary: string): string {
  const parts = [context, summary].filter(Boolean)
  return parts.filter((p, i) => parts.indexOf(p) === i).join(' · ')
}

function stepOf(item: Extract<ChatItem, { kind: 'tool' }>): ActivityStep | null {
  const label = toolStepLabel(item.name, item.labels)
  if (!label) return null
  return {
    id: item.id,
    kind: 'tool',
    label,
    detail: toolDetail(item.context, item.summary),
    durationS: item.durationS,
    done: item.done,
  }
}

/** Pure reducer: ChatItem[] → rows, grouping tool + reasoning runs into activity rows. */
export function groupToRows(items: ChatItem[]): ChatRow[] {
  const rows: ChatRow[] = []
  let i = 0
  while (i < items.length) {
    const item = items[i]
    if (item.kind === 'tool' || item.kind === 'reasoning') {
      const steps: ActivityStep[] = []
      while (i < items.length && (items[i].kind === 'tool' || items[i].kind === 'reasoning')) {
        const it = items[i]
        if (it.kind === 'tool') {
          const step = stepOf(it)
          if (step) steps.push(step)
        } else if (it.kind === 'reasoning') {
          if (it.text.trim()) {
            steps.push({
              id: it.id,
              kind: 'reasoning',
              label: t('chat.activity.reasoning'),
              detail: '',
              durationS: null,
              done: !it.streaming,
              reasoningText: it.text,
            })
          }
        }
        i++
      }
      if (steps.length > 0) {
        // First step's id keeps the row key stable while more steps stream in.
        rows.push({ kind: 'activity', id: steps[0].id, steps })
      }
      continue
    }
    rows.push({ kind: 'item', item })
    i++
  }
  return rows
}

/**
 * One-line summary for an activity row: "Working…" while any step is still
 * running, "Done · N steps · X s" once every step completed (the seconds part
 * only when the gateway reported durations — history rows have none).
 */
export function activitySummary(steps: ActivityStep[]): { running: boolean; text: string } {
  const running = steps.some(s => !s.done)
  if (running) return { running, text: t('chat.activity.working') }
  const n = steps.length
  const hasDuration = steps.some(s => s.durationS != null)
  if (!hasDuration) return { running, text: tp('chat.activity.doneSteps', n) }
  const total = steps.reduce((acc, s) => acc + (s.durationS ?? 0), 0)
  return { running, text: tp('chat.activity.doneSeconds', n, { seconds: Math.max(1, Math.round(total)) }) }
}
