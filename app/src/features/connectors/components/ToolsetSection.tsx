import { useEffect, useState } from 'react'
import { useT } from '../../../i18n'
import {
  getToolsetConfig,
  getToolsetModels,
  postToolsetSetup,
  setToolsetEnabled,
  setToolsetEnv,
  setToolsetModel,
  setToolsetProvider,
  toolsetConfigFields,
  type ToolsetConfig,
  type ToolsetModels,
  type ToolsetProvider,
} from '../../../lib/hermes/connectors'
import { Skeleton } from '../../../ui/Skeleton'
import { Toggle } from '../../../ui/Toggle'
import { ConfigForm } from './ConfigForm'

const activeProviderOf = (config: ToolsetConfig): ToolsetProvider | undefined =>
  config.providers.find(p => p.is_active) ??
  (config.active_provider ? config.providers.find(p => p.name === config.active_provider) : undefined) ??
  config.providers[0]

export function ToolsetSection({
  name,
  profile,
  enabled,
  onChanged,
}: {
  name: string
  profile?: string
  enabled: boolean
  onChanged: () => Promise<void> | void
}) {
  const [config, setConfig] = useState<ToolsetConfig | null>(null)
  const [models, setModels] = useState<ToolsetModels | null>(null)
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [providerKey, setProviderKey] = useState(0)
  const t = useT()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const c = await getToolsetConfig(name, profile)
        if (cancelled) return
        setConfig(c)
        const p = activeProviderOf(c)
        if (p) {
          const m = await getToolsetModels(name, p.name, profile).catch(() => null)
          if (!cancelled && m?.has_models) setModels(m)
        }
      } catch {
        if (!cancelled) setError(t('connectors.toolset.loadFailed'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [name, profile, providerKey, t])

  const provider = config ? activeProviderOf(config) : undefined

  const toggle = async (next: boolean) => {
    setBusy('toggle')
    setError('')
    setNote('')
    try {
      const res = await setToolsetEnabled(name, next, profile)
      if (res.post_setup_started) setNote(t('connectors.toolset.postSetupStarted'))
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.toolset.saveFailed'))
    } finally {
      setBusy('')
    }
  }

  const pickProvider = async (providerName: string) => {
    setBusy('provider')
    setError('')
    try {
      await setToolsetProvider(name, providerName, profile)
      setProviderKey(k => k + 1)
      setNote(t('connectors.toolset.providerChanged'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.toolset.providerChangeFailed'))
    } finally {
      setBusy('')
    }
  }

  const pickModel = async (model: string) => {
    setBusy('model')
    setError('')
    try {
      await setToolsetModel(name, model, profile)
      setNote(t('connectors.toolset.modelChanged'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.toolset.modelChangeFailed'))
    } finally {
      setBusy('')
    }
  }

  const runPostSetup = async () => {
    if (!provider?.post_setup) return
    setBusy('postsetup')
    setError('')
    try {
      await postToolsetSetup(name, provider.post_setup, profile)
      setNote(t('connectors.toolset.guidedStarted'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.toolset.guidedFailed'))
    } finally {
      setBusy('')
    }
  }

  if (!config) {
    return (
      <div className="list">
        <Skeleton />
        <Skeleton width={180} />
      </div>
    )
  }

  return (
    <>
      <div className="ui-section">
        <h2>{t('connectors.toolset.status')}</h2>
        <div className="list-row">
          <span className="list-row-body">
            <span className="list-row-title">{t('connectors.toolset.enabled')}</span>
            <span className="list-row-subtitle">{config.name}</span>
          </span>
          <span className="list-row-trailing">
            <Toggle checked={enabled} onChange={v => void toggle(v)} label={t('connectors.toolset.enabled')} />
          </span>
        </div>
      </div>

      {config.providers.length > 0 && (
        <div className="ui-section">
          <h2>{t('connectors.toolset.provider')}</h2>
          <select
            className="input"
            value={provider?.name ?? ''}
            disabled={busy === 'provider'}
            onChange={e => void pickProvider(e.target.value)}
          >
            {config.providers.map(p => (
              <option key={p.name} value={p.name}>
                {p.badge || p.name}
              </option>
            ))}
          </select>
          {provider?.requires_nous_auth && <p className="faint">{t('connectors.toolset.requiresNousAuth')}</p>}
          {provider?.post_setup && (
            <button
              type="button"
              className="btn btn-block"
              style={{ marginTop: 10 }}
              disabled={busy === 'postsetup'}
              onClick={() => void runPostSetup()}
            >
              {busy === 'postsetup' ? '…' : t('connectors.toolset.guidedSetup')}
            </button>
          )}
        </div>
      )}

      {provider && provider.env_vars.length > 0 && (
        <div className="ui-section">
          <h2>{t('connectors.toolset.keys')}</h2>
          <ConfigForm
            key={`${config.name}:${provider.name}`}
            fields={toolsetConfigFields(provider)}
            busy={busy === 'env'}
            submitLabel={t('connectors.toolset.saveKeys')}
            onSubmit={async ({ values }) => {
              setBusy('env')
              setError('')
              try {
                await setToolsetEnv(name, values, profile)
                setNote(t('connectors.toolset.keysSaved'))
                setProviderKey(k => k + 1)
              } catch (e) {
                setError(e instanceof Error ? e.message : t('connectors.toolset.keysSaveFailed'))
              } finally {
                setBusy('')
              }
            }}
          />
        </div>
      )}

      {models?.has_models && models.models.length > 0 && (
        <div className="ui-section">
          <h2>{t('connectors.toolset.model')}</h2>
          <select
            className="input"
            value={models.current ?? ''}
            disabled={busy === 'model'}
            onChange={e => void pickModel(e.target.value)}
          >
            {models.models.map(m => (
              <option key={m.id} value={m.id}>
                {m.display || m.id}
              </option>
            ))}
          </select>
        </div>
      )}

      {note && <p className="muted">{note}</p>}
      {error && <p className="error-text">{error}</p>}
    </>
  )
}
