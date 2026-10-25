import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT, useTp } from '../../../i18n'
import {
  hubIdentifier,
  installSkill,
  isHubId,
  previewSkill,
  toggleSkill,
  uninstallSkill,
  updateSkillHub,
  type HubPreview,
} from '../../../lib/hermes/connectors'
import { Sheet } from '../../../ui/Sheet'
import { Toggle } from '../../../ui/Toggle'

export function SkillSection({
  id,
  name,
  profile,
  enabled,
  hubProvenance,
  onChanged,
}: {
  id: string
  name: string
  profile?: string
  enabled: boolean
  hubProvenance: boolean
  onChanged: () => Promise<void> | void
}) {
  const navigate = useNavigate()
  const hub = isHubId(id)
  const [preview, setPreview] = useState<HubPreview | null>(null)
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<'uninstall' | null>(null)
  const t = useT()
  const tp = useTp()

  useEffect(() => {
    if (!hub) return
    let cancelled = false
    void previewSkill(hubIdentifier(id))
      .then(p => {
        if (!cancelled) setPreview(p)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [hub, id])

  const toggle = async (next: boolean) => {
    setBusy('toggle')
    setError('')
    try {
      await toggleSkill(name, next, profile)
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.skill.saveFailed'))
    } finally {
      setBusy('')
    }
  }

  const install = async () => {
    setBusy('install')
    setError('')
    try {
      await installSkill(hubIdentifier(id), profile)
      setNote(t('connectors.skill.installing'))
      await onChanged()
      navigate(
        `/bots/${encodeURIComponent(profile ?? 'default')}/connectors/skills/${encodeURIComponent(name)}`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.skill.installFailed'))
    } finally {
      setBusy('')
    }
  }

  const update = async () => {
    setBusy('update')
    setError('')
    try {
      await updateSkillHub(profile)
      setNote(t('connectors.skill.updating'))
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.skill.updateFailed'))
    } finally {
      setBusy('')
    }
  }

  const uninstall = async () => {
    setConfirm(null)
    setBusy('uninstall')
    setError('')
    try {
      await uninstallSkill(name, profile)
      navigate(`/bots/${encodeURIComponent(profile ?? 'default')}/connectors`)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.skill.uninstallFailed'))
      setBusy('')
    }
  }

  if (hub) {
    return (
      <>
        {preview?.skill_md && (
          <div className="ui-section">
            <h2>{t('connectors.skill.instructions')}</h2>
            <pre className="skill-md">{preview.skill_md}</pre>
            {preview.files.length > 0 && <p className="faint">{tp('connectors.skill.filesIncluded', preview.files.length)}</p>}
          </div>
        )}
        <button type="button" className="btn btn-primary btn-block" disabled={busy === 'install'} onClick={() => void install()}>
          {busy === 'install' ? '…' : t('connectors.skill.install')}
        </button>
        {preview?.trust_level && <p className="faint">{t('connectors.skill.hubTrust', { level: preview.trust_level })}</p>}
        {note && <p className="muted">{note}</p>}
        {error && <p className="error-text">{error}</p>}
      </>
    )
  }

  return (
    <>
      <div className="ui-section">
        <h2>{t('connectors.skill.status')}</h2>
        <div className="list-row">
          <span className="list-row-body">
            <span className="list-row-title">{t('connectors.skill.enabled')}</span>
          </span>
          <span className="list-row-trailing">
            <Toggle checked={enabled} onChange={v => void toggle(v)} label={t('connectors.skill.enabled')} />
          </span>
        </div>
      </div>
      {hubProvenance && (
        <div className="ui-section">
          <h2>{t('connectors.skill.hub')}</h2>
          <button type="button" className="btn btn-block" disabled={busy === 'update'} onClick={() => void update()}>
            {busy === 'update' ? '…' : t('connectors.skill.updateFromHub')}
          </button>
          <button
            type="button"
            className="btn btn-block"
            style={{ marginTop: 10, color: 'var(--danger)', borderColor: 'var(--danger)' }}
            disabled={busy === 'uninstall'}
            onClick={() => setConfirm('uninstall')}
          >
            {t('connectors.skill.uninstall')}
          </button>
          <Sheet open={confirm === 'uninstall'} onClose={() => setConfirm(null)} title={t('connectors.skill.uninstallTitle')}>
            <p className="muted">{t('connectors.skill.uninstallBody', { name })}</p>
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" className="btn" onClick={() => setConfirm(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn-danger" onClick={() => void uninstall()}>
                {t('connectors.skill.uninstall')}
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
