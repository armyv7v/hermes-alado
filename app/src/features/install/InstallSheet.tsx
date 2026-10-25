import { useState } from 'react'
import { APP_NAME } from '../../app/brand'
import { useT } from '../../i18n'
import { Icon } from '../../ui/Icon'
import { Sheet } from '../../ui/Sheet'
import './install.css'
import {
  canNativeInstall,
  dismissInstall,
  isIOS,
  triggerInstall,
} from './install-prompt'

/**
 * The first-run install invite: native "Install" on Android/Chromium, the
 * three manual steps on iOS Safari. "Not now" dismisses (re-offer once after
 * 14 days, handled by install-prompt.ts).
 */
export function InstallSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [installing, setInstalling] = useState(false)
  const native = canNativeInstall()
  const ios = isIOS()
  const t = useT()

  async function onInstall() {
    setInstalling(true)
    try {
      const accepted = await triggerInstall()
      if (accepted) {
        onClose()
        return
      }
    } finally {
      setInstalling(false)
    }
  }

  function onDismiss() {
    dismissInstall()
    onClose()
  }

  return (
    <Sheet open={open} onClose={onDismiss} title={t('install.title', { app: APP_NAME })}>
      {native ? (
        <>
          <p className="muted">
            {t('install.nativeBody', { app: APP_NAME })}
          </p>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 12 }}
            disabled={installing}
            onClick={() => void onInstall()}
          >
            {installing ? t('install.installing') : t('install.install')}
          </button>
          <button className="btn btn-block" style={{ marginTop: 8 }} onClick={onDismiss}>
            {t('common.later')}
          </button>
        </>
      ) : (
        <>
          <p className="muted">
            {t('install.manualBody')}
          </p>
          <ol className="install-steps">
            <li>
              <span className="install-step-icon">
                <Icon name="share" size={18} />
              </span>
              <span>
                {ios ? (
                  t('install.step1Ios', { share: t('install.iosShare') })
                ) : (
                  t('install.step1Chrome', { menu: '⋮', install: t('install.chromeInstall') })
                )}
              </span>
            </li>
            <li>
              <span className="install-step-icon">
                <Icon name="plus" size={18} />
              </span>
              <span>
                {t('install.step2', { addToHome: t('install.addToHome'), addToHomeScreen: t('install.addToHomeScreen') })}
              </span>
            </li>
            <li>
              <span className="install-step-icon">
                <Icon name="arrow-up" size={18} />
              </span>
              <span>
                {t('install.step3', { app: APP_NAME })}
              </span>
            </li>
          </ol>
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={onDismiss}>
            {t('install.gotIt')}
          </button>
        </>
      )}
    </Sheet>
  )
}
