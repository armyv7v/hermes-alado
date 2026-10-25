import { useStore } from '@nanostores/react'
import { connectionState, hasOpenedOnce } from '../lib/hermes/connection'
import { useT } from '../i18n'

export function ReconnectBanner() {
  const state = useStore(connectionState)
  const t = useT()
  const opened = hasOpenedOnce()

  if (!opened || state === 'open') return null

  return (
    <div className="reconnect-banner" role="status">
      <span className="connect-glyphs" aria-label={t('app.reconnecting')}>
        CONNECT
      </span>
    </div>
  )
}
