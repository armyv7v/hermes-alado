import { useStore } from '@nanostores/react'
import { useNavigate } from 'react-router-dom'
import { APP_NAME } from '../../app/brand'
import { useT } from '../../i18n'
import { loginUrl } from '../../lib/config'
import { backendUrl } from '../settings/store'
import { authError, authState, authStatus, checkAuth } from './store'

export function LoginPage() {
  const status = useStore(authStatus)
  const state = useStore(authState)
  const error = useStore(authError)
  const url = useStore(backendUrl)
  const navigate = useNavigate()
  const t = useT()

  const unreachable = status === 'error'

  return (
    <div className="login-wrap">
      <img className="login-logo-img" src="/icon.svg" alt="" width={88} height={88} />
      <h1 className="login-title">{APP_NAME}</h1>
      <p className="muted">{t('app.tagline')}</p>

      {unreachable && (
        <p className="error-text">{t('login.unreachable', { error: error ? `: ${error}` : '' })}</p>
      )}

      <p className="faint">
        {url ? t('login.backendUrl', { url }) : t('login.backendSameOrigin')}
      </p>

      {state?.mode === 'gated-anonymous' && (
        <button
          className="btn btn-primary btn-block"
          onClick={() => {
            window.location.href = loginUrl(window.location.pathname)
          }}
        >
          {t('login.signIn')}
        </button>
      )}

      {unreachable && (
        <button className="btn btn-primary btn-block" onClick={() => void checkAuth()}>
          {t('common.retry')}
        </button>
      )}

      <button className="btn btn-block" onClick={() => navigate('/settings')}>
        {t('login.configureBackend')}
      </button>
    </div>
  )
}
