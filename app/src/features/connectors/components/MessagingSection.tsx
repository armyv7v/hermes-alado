import { useState } from 'react'
import { useT, type TextKey } from '../../../i18n'
import {
  gatewayRestart,
  gatewayStart,
  gatewayStop,
  platformConfigFields,
  testPlatform,
  updatePlatform,
  type MessagingPlatform,
} from '../../../lib/hermes/connectors'
import { Toggle } from '../../../ui/Toggle'
import { ConfigForm } from './ConfigForm'
import { PairingPanel } from './PairingPanel'
import { TelegramOnboarding, WhatsappOnboarding } from './OnboardingPanels'

const GATEWAY_FAILED_KEYS: Record<'start' | 'stop' | 'restart', TextKey> = {
  start: 'connectors.messaging.gatewayStartFailed',
  stop: 'connectors.messaging.gatewayStopFailed',
  restart: 'connectors.messaging.gatewayRestartFailed',
}

export function MessagingSection({
  platform,
  profile,
  onChanged,
}: {
  platform: MessagingPlatform
  profile?: string
  onChanged: () => Promise<void> | void
}) {
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; state: string; message: string } | null>(null)
  const t = useT()

  const fields = platformConfigFields(platform)

  const toggle = async (enabled: boolean) => {
    setBusy('toggle')
    setError('')
    try {
      await updatePlatform(platform.id, { enabled }, profile)
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.messaging.saveFailed'))
    } finally {
      setBusy('')
    }
  }

  const saveConfig = async ({ values, clears }: { values: Record<string, string>; clears: string[] }) => {
    setBusy('config')
    setError('')
    setNote('')
    try {
      const res = await updatePlatform(
        platform.id,
        { env: values, ...(clears.length ? { clear_env: clears } : {}) },
        profile,
      )
      setNote(res.hot_served ? t('connectors.messaging.savedHot') : t('connectors.messaging.savedRestart'))
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.messaging.saveFailed'))
    } finally {
      setBusy('')
    }
  }

  const test = async () => {
    setBusy('test')
    setTestResult(null)
    setError('')
    try {
      setTestResult(await testPlatform(platform.id, profile))
    } catch (e) {
      setTestResult({ ok: false, state: 'error', message: e instanceof Error ? e.message : t('connectors.messaging.testFailed') })
    } finally {
      setBusy('')
    }
  }

  const gateway = async (action: 'start' | 'stop' | 'restart') => {
    setBusy(`gw-${action}`)
    setError('')
    try {
      if (action === 'start') await gatewayStart(profile)
      else if (action === 'stop') await gatewayStop(profile)
      else await gatewayRestart(profile)
      setNote(t('connectors.messaging.gatewaySent', { action }))
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : t(GATEWAY_FAILED_KEYS[action]))
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <div className="ui-section">
        <h2>{t('connectors.messaging.status')}</h2>
        <div className="list-row">
          <span className="list-row-body">
            <span className="list-row-title">{t('connectors.messaging.enabled')}</span>
            <span className="list-row-subtitle">{platform.state}</span>
          </span>
          <span className="list-row-trailing">
            <Toggle checked={platform.enabled} onChange={v => void toggle(v)} label={t('connectors.messaging.enabled')} />
          </span>
        </div>
        {platform.error_message && <p className="error-text">{platform.error_message}</p>}
      </div>

      <div className="ui-section">
        <h2>{t('connectors.messaging.gateway')}</h2>
        <p className="muted">{platform.gateway_running ? t('connectors.messaging.gatewayRunning') : t('connectors.messaging.gatewayStopped')}</p>
        <div className="row">
          {platform.gateway_running ? (
            <>
              <button type="button" className="btn" disabled={busy === 'gw-restart'} onClick={() => void gateway('restart')}>
                {t('connectors.messaging.restart')}
              </button>
              <button type="button" className="btn" disabled={busy === 'gw-stop'} onClick={() => void gateway('stop')}>
                {t('connectors.messaging.stop')}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" disabled={busy === 'gw-start'} onClick={() => void gateway('start')}>
              {t('connectors.messaging.start')}
            </button>
          )}
        </div>
      </div>

      {fields.length > 0 && (
        <div className="ui-section">
          <h2>{t('connectors.messaging.config')}</h2>
          <ConfigForm
            key={platform.id}
            fields={fields}
            busy={busy === 'config'}
            submitLabel={t('connectors.messaging.save')}
            onSubmit={saveConfig}
          />
        </div>
      )}

      <div className="ui-section">
        <h2>{t('connectors.mcp.test')}</h2>
        <button type="button" className="btn btn-block" disabled={busy === 'test'} onClick={() => void test()}>
          {busy === 'test' ? t('connectors.messaging.testing') : t('connectors.messaging.testChannel')}
        </button>
        {testResult && (
          <div className="card" style={{ marginTop: 10 }}>
            <p className={testResult.ok ? 'chip ok' : 'error-text'}>{testResult.message}</p>
          </div>
        )}
      </div>

      {platform.id === 'telegram' && (
        <div className="ui-section">
          <h2>{t('connectors.messaging.linkTelegram')}</h2>
          <TelegramOnboarding profile={profile} onDone={onChanged} />
        </div>
      )}

      {platform.id === 'whatsapp' && (
        <div className="ui-section">
          <h2>{t('connectors.messaging.linkWhatsapp')}</h2>
          <WhatsappOnboarding profile={profile} onDone={onChanged} />
        </div>
      )}

      <PairingPanel profile={profile} onChanged={onChanged} />

      {note && <p className="muted">{note}</p>}
      {error && <p className="error-text">{error}</p>}
    </>
  )
}
