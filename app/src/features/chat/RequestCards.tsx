import { useState } from 'react'
import { useT } from '../../i18n'
import { resolveRequest, type ClarifyQ, type ServerRequestCard } from './requests'

const APPROVAL_LABEL_KEYS = {
  once: 'chat.approvals.once',
  session: 'chat.approvals.session',
  always: 'chat.approvals.always',
  deny: 'chat.approvals.deny',
} as const

function vibrate(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(10)
}

export function RequestCard({ card, bot }: { card: ServerRequestCard; bot: string }) {
  if (card.kind === 'approval') {
    return <ApprovalCard card={card} bot={bot} />
  }
  return <ClarifyCard card={card} bot={bot} />
}

function ApprovalCard({ card, bot }: { card: Extract<ServerRequestCard, { kind: 'approval' }>; bot: string }) {
  const [busy, setBusy] = useState(false)
  const t = useT()

  function answer(choice: string) {
    vibrate()
    setBusy(true)
    resolveRequest(card, { choice })
  }

  return (
    <div className="request-card">
      <div className="request-card-head">
        <span className="request-card-title">{t('chat.approvalTitle')}</span>
        <span className="faint">{bot}</span>
      </div>
      {card.command && <div className="confirm-cmd">{card.command}</div>}
      {card.description && <p className="request-card-desc">{card.description}</p>}
      <div className="request-card-actions">
        {(card.choices.length ? card.choices : ['once', 'session', 'always', 'deny']).map(choice => {
          const key = APPROVAL_LABEL_KEYS[choice as keyof typeof APPROVAL_LABEL_KEYS]
          return (
            <button
              key={choice}
              className={`btn${choice === 'deny' ? ' btn-danger' : ' btn-primary'}`}
              disabled={busy}
              onClick={() => answer(choice)}
            >
              {key ? t(key) : choice}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ClarifyCard({ card, bot }: { card: Extract<ServerRequestCard, { kind: 'clarify' }>; bot: string }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const t = useT()

  function submit() {
    setBusy(true)
    const result: Record<string, string | null> = {}
    for (const q of card.questions) result[q.qid] = answers[q.qid]?.trim() || null
    resolveRequest(card, { answers: result })
  }

  function cancel() {
    setBusy(true)
    resolveRequest(card, {})
  }

  return (
    <div className="request-card">
      <div className="request-card-head">
        <span className="request-card-title">{t('chat.questionsTitle')}</span>
        <span className="faint">{bot}</span>
      </div>
      {card.questions.map(q => (
        <Question key={q.qid} q={q} value={answers[q.qid] ?? ''} onChange={v => setAnswers(a => ({ ...a, [q.qid]: v }))} />
      ))}
      <div className="request-card-actions">
        <button className="btn btn-primary" disabled={busy} onClick={submit}>
          {t('chat.respond')}
        </button>
        <button className="btn" disabled={busy} onClick={cancel}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}

function Question({ q, value, onChange }: { q: ClarifyQ; value: string; onChange: (v: string) => void }) {
  const t = useT()
  return (
    <div className="clarify-q">
      <div className="clarify-q-text">{q.question}</div>
      {q.choices.length > 0 ? (
        <div className="clarify-chips">
          {q.choices.map(c => (
            <button
              key={c}
              className={`chip${value === c ? ' chip-selected' : ''}`}
              onClick={() => onChange(value === c ? '' : c)}
            >
              {c}
            </button>
          ))}
        </div>
      ) : (
        <input
          className="input"
          style={{ marginTop: 6 }}
          placeholder={t('chat.answerPlaceholder')}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      )}
    </div>
  )
}
