import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '@nanostores/react'
import { useSlideNavigate } from '../../app/transition'
import { useT, type TextKey } from '../../i18n'
import { isValidEnvVarName, type EnvVarInfo } from '../../lib/hermes/credentials'
import { vaultLabel } from '../../lib/hermes/vault-labels'
import { vaultBrandName } from './vault-brand'
import { BrandIcon } from '../../ui/BrandIcon'
import { BotScopedScreen } from '../bot-profile/BotScopedScreen'
import { Disclosure } from '../../ui/Disclosure'
import { Row, Section } from '../../ui/Section'
import { Skeleton } from '../../ui/Skeleton'
import { StatusDot } from '../../ui/StatusDot'
import { ConfirmSheet } from './ConfirmSheet'
import {
  addPoolEntry,
  envError,
  envLoading,
  envVars,
  loadEnvVars,
  loadPool,
  pool,
  poolError,
  poolLoading,
  removePoolEntry,
  saveVar,
} from './store'
import './vault.css'

const CATEGORY_KEYS: Record<string, TextKey> = {
  provider: 'vault.categories.provider',
  tool: 'vault.categories.tool',
  skill: 'vault.categories.skill',
  messaging: 'vault.categories.messaging',
  setting: 'vault.categories.setting',
}

function categoryLabel(category: string, t: (k: TextKey) => string): string {
  const key = CATEGORY_KEYS[category]
  return key ? t(key) : category.charAt(0).toUpperCase() + category.slice(1)
}

export function VaultPage() {
  const { profile = 'default' } = useParams()
  const { forward } = useSlideNavigate()
  const vars = useStore(envVars)
  const loading = useStore(envLoading)
  const error = useStore(envError)
  const credPool = useStore(pool)
  const poolBusy = useStore(poolLoading)
  const poolFail = useStore(poolError)
  const t = useT()

  const [busyKey, setBusyKey] = useState('')
  const [removeTarget, setRemoveTarget] = useState<{ provider: string; index: number } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Custom "KEY=value" form
  const [customKey, setCustomKey] = useState('')
  const [customValue, setCustomValue] = useState('')
  const [customError, setCustomError] = useState('')
  const [customBusy, setCustomBusy] = useState(false)

  // Pool add form
  const [poolProvider, setPoolProvider] = useState('')
  const [poolLabel, setPoolLabel] = useState('')
  const [poolKey, setPoolKey] = useState('')
  const [poolAddError, setPoolAddError] = useState('')
  const [poolAddBusy, setPoolAddBusy] = useState(false)

  useEffect(() => {
    void Promise.all([loadEnvVars(profile), loadPool(profile)])
  }, [profile])

  const { groups, advancedVars, customVars } = useMemo(() => {
    const byCat = new Map<string, [string, EnvVarInfo][]>()
    const advanced: [string, EnvVarInfo][] = []
    const custom: [string, EnvVarInfo][] = []
    for (const [key, info] of Object.entries(vars ?? {})) {
      if (info.category === 'custom' || info.custom) {
        custom.push([key, info])
        continue
      }
      if (info.advanced || info.channel_managed) {
        advanced.push([key, info])
        continue
      }
      const bucket = byCat.get(info.category) ?? []
      bucket.push([key, info])
      byCat.set(info.category, bucket)
    }
    for (const rows of byCat.values()) rows.sort(([a], [b]) => a.localeCompare(b))
    advanced.sort(([a], [b]) => a.localeCompare(b))
    custom.sort(([a], [b]) => a.localeCompare(b))
    const sorted = new Map([...byCat.entries()].sort(([a], [b]) => categoryLabel(a, t).localeCompare(categoryLabel(b, t))))
    return { groups: sorted, advancedVars: advanced, customVars: custom }
  }, [vars, t])

  const providers = credPool?.providers ?? []
  const enc = encodeURIComponent(profile)

  async function onRemove() {
    if (!removeTarget) return
    setBusyKey(`${removeTarget.provider}/${removeTarget.index}`)
    try {
      await removePoolEntry(profile, removeTarget.provider, removeTarget.index)
    } finally {
      setBusyKey('')
      setRemoveTarget(null)
      setConfirmOpen(false)
    }
  }

  async function onAddCustom() {
    const key = customKey.trim()
    const value = customValue
    if (!key) {
      setCustomError(t('vault.nameRequired'))
      return
    }
    if (!isValidEnvVarName(key)) {
      setCustomError(t('vault.nameInvalid'))
      return
    }
    if (!value) {
      setCustomError(t('vault.valueRequired'))
      return
    }
    setCustomError('')
    setCustomBusy(true)
    try {
      await saveVar(profile, key, value)
      setCustomKey('')
      setCustomValue('')
    } catch (e) {
      setCustomError(e instanceof Error ? e.message : t('vault.saveFailed'))
    } finally {
      setCustomBusy(false)
    }
  }

  async function onAddPoolEntry() {
    const provider = poolProvider.trim()
    const apiKey = poolKey
    if (!provider || !apiKey) {
      setPoolAddError(t('vault.providerKeyRequired'))
      return
    }
    setPoolAddError('')
    setPoolAddBusy(true)
    try {
      await addPoolEntry(profile, provider, apiKey, poolLabel.trim())
      setPoolProvider('')
      setPoolKey('')
      setPoolLabel('')
    } catch (e) {
      setPoolAddError(e instanceof Error ? e.message : t('vault.saveKeyFailed'))
    } finally {
      setPoolAddBusy(false)
    }
  }

  function renderVarRow(key: string, info: EnvVarInfo) {
    const label = vaultLabel(key, info)
    const brand = vaultBrandName(key, info)
    return (
      <Row
        key={key}
        leading={<BrandIcon name={brand ?? info.provider_label ?? info.provider ?? key} size={28} />}
        title={<span className="vault-title">{label}</span>}
        trailing={
          <StatusDot
            tone={info.is_set ? 'ok' : 'neutral'}
            ariaLabel={info.is_set ? t('vault.configured') : t('vault.notConfigured')}
          />
        }
        onClick={() => forward(`/bots/${enc}/vault/${encodeURIComponent(key)}`)}
      >
        <span className="row-key mono">{key}</span>
      </Row>
    )
  }

  return (
    <BotScopedScreen profile={profile} title={t('vault.title')}>
      <p className="page-subtitle">
        {t('vault.subtitle')}
      </p>

      {loading ? (
        <div className="list">
          <Skeleton width="60%" />
          <Skeleton height={64} />
          <Skeleton height={64} />
          <Skeleton height={64} />
        </div>
      ) : error ? (
        <div className="empty">
          <p className="error-text">{error}</p>
          <button className="btn" onClick={() => void loadEnvVars(profile)}>
            {t('common.retry')}
          </button>
        </div>
      ) : (
        <>
          {groups.size === 0 && advancedVars.length === 0 && customVars.length === 0 ? (
            <div className="empty">
              <p className="muted">{t('vault.empty')}</p>
            </div>
          ) : (
            [...groups.entries()].map(([category, rows]) => (
              <Section key={category} label={categoryLabel(category, t)}>
                {rows.map(([key, info]) => renderVarRow(key, info))}
              </Section>
            ))
          )}

          {advancedVars.length > 0 && (
            <div className="advanced-block">
              <Disclosure title={t('vault.showAdvanced', { count: advancedVars.length })}>
                <Section>{advancedVars.map(([key, info]) => renderVarRow(key, info))}</Section>
              </Disclosure>
            </div>
          )}

          {/* Grupo de credenciales (auth.json credential_pool) */}
          <Section label={t('vault.pool')}>
            {poolBusy ? (
              <div className="list">
                <Skeleton height={64} />
              </div>
            ) : poolFail ? (
              <div className="empty">
                <p className="error-text">{poolFail}</p>
                <button className="btn" onClick={() => void loadPool(profile)}>
                  {t('common.retry')}
                </button>
              </div>
            ) : providers.length === 0 ? (
              <p className="muted" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                {t('vault.poolEmpty')}
              </p>
            ) : (
              providers.map(p => (
                <div key={p.provider} className="vault-pool">
                  <div className="vault-pool-provider">{p.provider}</div>
                  {p.entries.map(entry => (
                    <div key={`${p.provider}-${entry.index}`} className="vault-pool-row">
                      <div className="vault-pool-info">
                        <span>{entry.label}</span>
                        <span className="faint mono">{entry.token_preview}</span>
                        <span className="faint">
                          {entry.has_refresh ? t('vault.autoRenew') : t('vault.noRenew')}
                          {entry.last_status ? ` · ${entry.last_status}` : ''}
                        </span>
                      </div>
                      <button
                        className="btn btn-sm btn-danger"
                        disabled={busyKey === `${p.provider}/${entry.index}`}
                        onClick={() => {
                          setRemoveTarget({ provider: p.provider, index: entry.index })
                          setConfirmOpen(true)
                        }}
                      >
                        {t('vault.remove')}
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </Section>

          {/* Variables personalizadas */}
          <Section label={t('vault.customSection')}>
            {customVars.length === 0 ? (
              <p className="muted" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                {t('vault.customEmpty')}
              </p>
            ) : (
              customVars.map(([key, info]) => renderVarRow(key, info))
            )}
          </Section>

          <Section label={t('vault.newVar')}>
            <div className="card">
              <input
                className="input"
                placeholder={t('vault.namePlaceholder')}
                autoCapitalize="characters"
                spellCheck={false}
                value={customKey}
                onChange={e => setCustomKey(e.target.value)}
              />
              <input
                className="input"
                style={{ marginTop: 8 }}
                type="password"
                placeholder={t('vault.value')}
                value={customValue}
                onChange={e => setCustomValue(e.target.value)}
              />
              {customError && <p className="error-text">{customError}</p>}
              <button
                className="btn btn-primary btn-block"
                style={{ marginTop: 10 }}
                disabled={customBusy}
                onClick={() => void onAddCustom()}
              >
                {customBusy ? t('common.saving') : t('vault.saveVar')}
              </button>
            </div>
          </Section>

          <Section label={t('vault.providerKeySection')}>
            <div className="card">
              <input
                className="input"
                placeholder={t('vault.providerPlaceholder')}
                value={poolProvider}
                onChange={e => setPoolProvider(e.target.value)}
              />
              <input
                className="input"
                style={{ marginTop: 8 }}
                placeholder={t('vault.labelOptional')}
                value={poolLabel}
                onChange={e => setPoolLabel(e.target.value)}
              />
              <input
                className="input"
                style={{ marginTop: 8 }}
                type="password"
                placeholder={t('vault.key')}
                value={poolKey}
                onChange={e => setPoolKey(e.target.value)}
              />
              {poolAddError && <p className="error-text">{poolAddError}</p>}
              <button
                className="btn btn-primary btn-block"
                style={{ marginTop: 10 }}
                disabled={poolAddBusy}
                onClick={() => void onAddPoolEntry()}
              >
                {poolAddBusy ? t('common.saving') : t('vault.saveKey')}
              </button>
            </div>
          </Section>
        </>
      )}

      <ConfirmSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('vault.removeKey')}
        body={t('vault.removeKeyBody')}
        confirmLabel={t('vault.remove')}
        busy={busyKey !== ''}
        onConfirm={() => void onRemove()}
      />
    </BotScopedScreen>
  )
}
