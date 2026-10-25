import { useEffect, useRef, useState } from 'react'
import { useT } from '../../../i18n'
import {
  applyTelegramOnboarding,
  applyWhatsappOnboarding,
  cancelTelegramOnboarding,
  cancelWhatsappOnboarding,
  getTelegramOnboarding,
  getWhatsappOnboarding,
  startTelegramOnboarding,
  startWhatsappOnboarding,
  type TelegramOnboarding,
  type WhatsappOnboarding,
} from '../../../lib/hermes/connectors'
import { QrCode } from './QrCode'

const POLL_MS = 2000

function usePolling(callback: () => Promise<boolean>, active: boolean): void {
  const cbRef = useRef(callback)
  useEffect(() => {
    cbRef.current = callback
  })
  useEffect(() => {
    if (!active) return
    let cancelled = false
    const tick = async () => {
      const stop = await cbRef.current()
      if (!cancelled && !stop) {
        timer.current = window.setTimeout(() => void tick(), POLL_MS)
      }
    }
    const timer = { current: window.setTimeout(() => void tick(), POLL_MS) }
    return () => {
      cancelled = true
      window.clearTimeout(timer.current)
    }
  }, [active])
}

const TERMINAL_WHATSAPP = new Set(['connected', 'error', 'expired', 'cancelled'])

export function TelegramOnboarding({
  profile,
  onDone,
}: {
  profile?: string
  onDone: () => Promise<void> | void
}) {
  const [phase, setPhase] = useState<'idle' | 'starting' | 'waiting' | 'ready' | 'error'>('idle')
  const [data, setData] = useState<TelegramOnboarding | null>(null)
  const [allowedIds, setAllowedIds] = useState('')
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const t = useT()

  const start = async () => {
    setError('')
    setPhase('starting')
    try {
      const res = await startTelegramOnboarding('Hermes Agent', profile)
      setData(res)
      setPhase(res.status === 'ready' ? 'ready' : 'waiting')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.onboarding.startFailed'))
      setPhase('error')
    }
  }

  usePolling(
    async () => {
      if (!data) return true
      try {
        const res = await getTelegramOnboarding(data.pairing_id)
        setData(res)
        if (res.status === 'ready') {
          setPhase('ready')
          return true
        }
        return false
      } catch (e) {
        const status = (e as { status?: number }).status
        setError(status === 410 ? t('connectors.onboarding.codeExpired') : t('connectors.onboarding.verifyFailed'))
        setPhase('error')
        return true
      }
    },
    phase === 'waiting' && data !== null,
  )

  const apply = async () => {
    if (!data) return
    setApplying(true)
    setError('')
    const ids = allowedIds
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(Boolean)
    try {
      await applyTelegramOnboarding(data.pairing_id, ids, profile)
      setPhase('idle')
      setData(null)
      setAllowedIds('')
      await onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.onboarding.applyFailed'))
      setPhase('ready')
    } finally {
      setApplying(false)
    }
  }

  const cancel = async () => {
    if (data) await cancelTelegramOnboarding(data.pairing_id).catch(() => undefined)
    setPhase('idle')
    setData(null)
    setAllowedIds('')
  }

  if (phase === 'idle') {
    return (
      <button type="button" className="btn btn-block" onClick={() => void start()}>
        {t('connectors.onboarding.linkWithQr')}
      </button>
    )
  }

  return (
    <div className="onboarding">
      {phase === 'starting' && <p className="muted">{t('connectors.onboarding.starting')}</p>}
      {(phase === 'waiting' || phase === 'ready') && data && (
        <>
          {data.qr_payload && (
            <div className="qr-card">
              <QrCode value={data.qr_payload} />
              <p className="faint">{t('connectors.onboarding.scanTelegram')}</p>
            </div>
          )}
          {data.deep_link && (
            <a className="btn btn-block" style={{ marginTop: 10 }} href={data.deep_link} target="_blank" rel="noreferrer">
              {t('connectors.onboarding.openTelegram')}
            </a>
          )}
          {data.suggested_username && <p className="muted">{t('connectors.onboarding.botPrefix', { username: data.suggested_username })}</p>}
          {phase === 'ready' && (
            <>
              <label className="config-label" htmlFor="tg-ids">
                {t('connectors.onboarding.allowedIds')}
              </label>
              <textarea
                id="tg-ids"
                className="input"
                rows={3}
                value={allowedIds}
                onChange={e => setAllowedIds(e.target.value)}
                placeholder="123456789, 987654321"
              />
              <div className="row" style={{ marginTop: 10 }}>
                <button type="button" className="btn" onClick={() => void cancel()}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={applying}
                  onClick={() => void apply()}
                >
                  {applying ? '…' : t('connectors.onboarding.finishLink')}
                </button>
              </div>
            </>
          )}
          {phase === 'waiting' && (
            <button type="button" className="btn" style={{ marginTop: 10 }} onClick={() => void cancel()}>
              {t('common.cancel')}
            </button>
          )}
        </>
      )}
      {phase === 'error' && (
        <>
          <p className="error-text">{error}</p>
          <button type="button" className="btn" onClick={() => void cancel()}>
            {t('common.close')}
          </button>
        </>
      )}
    </div>
  )
}

export function WhatsappOnboarding({
  profile,
  onDone,
}: {
  profile?: string
  onDone: () => Promise<void> | void
}) {
  const [phase, setPhase] = useState<'idle' | 'starting' | 'waiting' | 'connected' | 'error'>('idle')
  const [data, setData] = useState<WhatsappOnboarding | null>(null)
  const [mode, setMode] = useState<'bot' | 'self-chat'>('bot')
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const t = useT()

  const start = async () => {
    setError('')
    setPhase('starting')
    try {
      const res = await startWhatsappOnboarding(mode, profile)
      setData(res)
      if (res.status === 'connected') setPhase('connected')
      else if (TERMINAL_WHATSAPP.has(res.status)) {
        setError(res.error ?? t('connectors.onboarding.statusPrefix', { status: res.status }))
        setPhase('error')
      } else setPhase('waiting')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.onboarding.startFailed'))
      setPhase('error')
    }
  }

  usePolling(
    async () => {
      if (!data) return true
      try {
        const res = await getWhatsappOnboarding(data.pairing_id)
        setData(res)
        if (res.status === 'connected') {
          setPhase('connected')
          return true
        }
        if (TERMINAL_WHATSAPP.has(res.status) && res.status !== 'connected') {
          setError(res.error ?? t('connectors.onboarding.statusPrefix', { status: res.status }))
          setPhase('error')
          return true
        }
        return false
      } catch (e) {
        const status = (e as { status?: number }).status
        setError(status === 410 ? t('connectors.onboarding.codeExpired') : t('connectors.onboarding.verifyFailed'))
        setPhase('error')
        return true
      }
    },
    phase === 'waiting' && data !== null,
  )

  const apply = async () => {
    if (!data) return
    setApplying(true)
    setError('')
    try {
      await applyWhatsappOnboarding(data.pairing_id, mode, profile)
      setPhase('idle')
      setData(null)
      await onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.onboarding.applyFailed'))
      setPhase('connected')
    } finally {
      setApplying(false)
    }
  }

  const cancel = async () => {
    if (data) await cancelWhatsappOnboarding(data.pairing_id).catch(() => undefined)
    setPhase('idle')
    setData(null)
  }

  if (phase === 'idle') {
    return (
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <select className="input" style={{ flex: 1 }} value={mode} onChange={e => setMode(e.target.value as 'bot' | 'self-chat')}>
          <option value="bot">{t('connectors.onboarding.botMode')}</option>
          <option value="self-chat">{t('connectors.onboarding.selfChat')}</option>
        </select>
        <button type="button" className="btn btn-primary" onClick={() => void start()}>
          {t('connectors.onboarding.link')}
        </button>
      </div>
    )
  }

  return (
    <div className="onboarding">
      {(phase === 'starting' || phase === 'waiting') && (
        <>
          {data?.qr_payload && (
            <div className="qr-card">
              <QrCode value={data.qr_payload} />
              <p className="faint">{t('connectors.onboarding.scanWhatsapp')}</p>
            </div>
          )}
          <p className="muted">
            {phase === 'starting' ? t('connectors.onboarding.preparing') : t('connectors.onboarding.waitingScan', { status: data?.status ?? 'waiting' })}
          </p>
          <button type="button" className="btn" onClick={() => void cancel()}>
            {t('common.cancel')}
          </button>
        </>
      )}
      {phase === 'connected' && data && (
        <>
          <p className="chip ok">
            {t('connectors.onboarding.connected')}
            {data.account_name ? t('connectors.onboarding.connectedAs', { name: data.account_name }) : ''}
            {data.account_phone ? ` (${data.account_phone})` : ''}
          </p>
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="btn" onClick={() => void cancel()}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={applying} onClick={() => void apply()}>
              {applying ? '…' : t('connectors.onboarding.saveLink')}
            </button>
          </div>
        </>
      )}
      {phase === 'error' && (
        <>
          <p className="error-text">{error}</p>
          <button type="button" className="btn" onClick={() => void cancel()}>
            {t('common.close')}
          </button>
        </>
      )}
    </div>
  )
}
