import { useState, type ReactNode } from 'react'
import { useT } from '../i18n'
import { Sheet } from './Sheet'

/**
 * Destructive-confirm sheet: explains what is lost, and only arms the danger
 * button once the user types the exact name. Shared by "Eliminar bot" and
 * "Eliminar grupo" so both confirmations feel (and are) the same.
 *
 * Mount it conditionally (`{confirmOpen && <DangerConfirmSheet …/>}`): the
 * typed text is component state, so each opening starts empty with no reset
 * effects.
 */
export function DangerConfirmSheet({
  onClose,
  title,
  body,
  nameToType,
  confirmLabel,
  busy = false,
  error,
  onConfirm,
}: {
  onClose: () => void
  title: string
  body: ReactNode
  /** The exact string the user must type (the bot/group name). */
  nameToType: string
  confirmLabel: string
  busy?: boolean
  error?: string
  onConfirm: () => void
}) {
  const [typed, setTyped] = useState('')
  const t = useT()
  const ready = nameToType.length > 0 && typed === nameToType

  return (
    <Sheet open onClose={onClose} title={title}>
      <p className="muted" style={{ marginTop: 0 }}>
        {body}
      </p>
      <label className="faint">
        {t('common.typeToConfirm', { name: nameToType })}
      </label>
      <input
        className="input"
        style={{ marginTop: 6 }}
        value={typed}
        onChange={e => setTyped(e.target.value)}
        placeholder={nameToType}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        className="btn btn-danger btn-block"
        style={{ marginTop: 10 }}
        disabled={!ready || busy}
        onClick={onConfirm}
      >
        {busy ? t('common.deleting') : confirmLabel}
      </button>
      {error ? <p className="error-text" style={{ marginBottom: 0 }}>{error}</p> : null}
    </Sheet>
  )
}
