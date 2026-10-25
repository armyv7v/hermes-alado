import { Component, type ErrorInfo, type ReactNode } from 'react'
import { t } from '../i18n'

/**
 * Catches a render crash so one bad message or screen never blanks the whole
 * app. `fallback` replaces the failed subtree; `resetKey` (e.g. the route)
 * clears the error when it changes.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; resetKey?: string },
  { failed: boolean; key?: string }
> {
  state = { failed: false, key: this.props.resetKey }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  static getDerivedStateFromProps(
    props: { resetKey?: string },
    state: { failed: boolean; key?: string },
  ): { failed: boolean; key?: string } | null {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** Screen-level fallback: a short note and a reload button instead of a blank page. */
export function ScreenCrash() {
  return (
    <div className="screen-crash">
      <p>{t('app.crashTitle')}</p>
      <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
        {t('app.reload')}
      </button>
    </div>
  )
}
