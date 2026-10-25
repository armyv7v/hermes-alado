import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../../../i18n'
import {
  disablePlugin,
  enablePlugin,
  removePlugin,
  updatePlugin,
  type PluginRow,
} from '../../../lib/hermes/connectors'
import { Sheet } from '../../../ui/Sheet'
import { Toggle } from '../../../ui/Toggle'

export function PluginSection({
  name,
  profile,
  row,
  onChanged,
}: {
  name: string
  profile?: string
  row: PluginRow | undefined
  onChanged: () => Promise<void> | void
}) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const t = useT()

  const enabled = row?.runtime_status === 'enabled'

  const toggle = async (next: boolean) => {
    setBusy('toggle')
    setError('')
    setNote('')
    try {
      const res = next ? await enablePlugin(name, profile) : await disablePlugin(name, profile)
      if (res.restart_required) setNote(t('connectors.plugin.restartNote'))
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.plugin.saveFailed'))
    } finally {
      setBusy('')
    }
  }

  const update = async () => {
    setBusy('update')
    setError('')
    try {
      await updatePlugin(name, profile)
      setNote(t('connectors.plugin.updating'))
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.plugin.updateFailed'))
    } finally {
      setBusy('')
    }
  }

  const remove = async () => {
    setConfirmRemove(false)
    setBusy('remove')
    try {
      await removePlugin(name, profile)
      navigate(`/bots/${encodeURIComponent(profile ?? 'default')}/connectors`)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.plugin.removeFailed'))
      setBusy('')
    }
  }

  return (
    <>
      <div className="ui-section">
        <h2>{t('connectors.plugin.status')}</h2>
        <div className="list-row">
          <span className="list-row-body">
            <span className="list-row-title">{t('connectors.plugin.enabled')}</span>
            {row?.version && <span className="list-row-subtitle">v{row.version}</span>}
          </span>
          <span className="list-row-trailing">
            <Toggle checked={enabled} onChange={v => void toggle(v)} label={t('connectors.plugin.enabled')} />
          </span>
        </div>
        {row?.auth_required && row.auth_command && (
          <p className="faint" style={{ marginTop: 8 }}>
            {t('connectors.plugin.needsLogin', { command: row.auth_command })}
          </p>
        )}
      </div>

      {(row?.can_update_git || row?.can_remove) && (
        <div className="ui-section">
          <h2>{t('connectors.plugin.maintenance')}</h2>
          {row?.can_update_git && (
            <button type="button" className="btn btn-block" disabled={busy === 'update'} onClick={() => void update()}>
              {busy === 'update' ? '…' : t('connectors.plugin.update')}
            </button>
          )}
          {row?.can_remove && (
            <button
              type="button"
              className="btn btn-block"
              style={{ marginTop: row?.can_update_git ? 10 : 0, color: 'var(--danger)', borderColor: 'var(--danger)' }}
              disabled={busy === 'remove'}
              onClick={() => setConfirmRemove(true)}
            >
              {t('connectors.plugin.remove')}
            </button>
          )}
          <Sheet open={confirmRemove} onClose={() => setConfirmRemove(false)} title={t('connectors.plugin.removeTitle')}>
            <p className="muted">{t('connectors.plugin.removeBody', { name })}</p>
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" className="btn" onClick={() => setConfirmRemove(false)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn-danger" onClick={() => void remove()}>
                {t('connectors.plugin.remove')}
              </button>
            </div>
          </Sheet>
        </div>
      )}
      {note && <p className="muted">{note}</p>}
      {error && <p className="error-text">{error}</p>}
    </>
  )
}
