import { useEffect, useState } from 'react'
import { useStore } from '@nanostores/react'
import { APP_NAME } from '../../app/brand'
import { useBack, useSlideNavigate } from '../../app/transition'
import { localeChoice, setLocaleChoice, useT, type LocaleChoice } from '../../i18n'
import { activeProfile, featuredBotName } from '../home/store'
import { loadProbes, probeSummary, probeSummaryLabel } from '../health/store'
import { InstallSheet } from '../install/InstallSheet'
import {
  canNativeInstall,
  installablePlatform,
  isStandalone,
  triggerInstall,
} from '../install/install-prompt'
import { Disclosure } from '../../ui/Disclosure'
import { PageShell } from '../../ui/PageShell'
import { Row, Section } from '../../ui/Section'
import { StatusDot } from '../../ui/StatusDot'
import { Toggle } from '../../ui/Toggle'
import {
  pushBusy,
  pushError,
  pushSetup,
  pushTested,
  refreshPushStatus,
  setMasterEnabled,
  testPush,
} from '../push/store'
import { checkAuth, user } from '../auth/store'
import { backendUrl, setTheme, theme, updateBackendUrl, type ThemeChoice } from './store'

const THEME_OPTIONS: { value: ThemeChoice; labelKey: 'settings.theme.system' | 'settings.theme.hermes' | 'settings.theme.clean' }[] = [
  { value: 'system', labelKey: 'settings.theme.system' },
  { value: 'hermes', labelKey: 'settings.theme.hermes' },
  { value: 'clean', labelKey: 'settings.theme.clean' },
]

const LANGUAGE_OPTIONS: { value: LocaleChoice; labelKey: 'settings.languageSystem' | 'settings.languageEnglish' | 'settings.languageSpanish' }[] = [
  { value: 'system', labelKey: 'settings.languageSystem' },
  { value: 'en', labelKey: 'settings.languageEnglish' },
  { value: 'es', labelKey: 'settings.languageSpanish' },
]

export function SettingsPage() {
  const back = useBack('/')
  const { forward } = useSlideNavigate()
  const url = useStore(backendUrl)
  const me = useStore(user)
  const currentTheme = useStore(theme)
  const setup = useStore(pushSetup)
  const busy = useStore(pushBusy)
  const error = useStore(pushError)
  const tested = useStore(pushTested)
  const healthTone = useStore(probeSummary)
  const activeProfileName = useStore(activeProfile)
  const [draft, setDraft] = useState(url)
  const [saved, setSaved] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  const t = useT()

  const showInstallRow = !isStandalone() && installablePlatform()

  // The bot the per-bot hint row opens, and the one whose probes feed the
  // server-health dot: the featured bot, else the server's active one.
  const principal = featuredBotName() ?? activeProfileName ?? 'default'

  useEffect(() => {
    void refreshPushStatus()
    void loadProbes(principal)
  }, [principal])

  async function onSave() {
    updateBackendUrl(draft)
    setSaved(true)
    await checkAuth()
    setTimeout(() => setSaved(false), 2000)
  }

  const displayName = me?.display_name ?? me?.email ?? 'Hermes'
  const email = me?.email ?? me?.provider

  const pushOn = setup?.state === 'on'
  const notifSubtitle = (() => {
    switch (setup?.state) {
      case 'unsupported':
        return t('settings.pushSub.unsupported')
      case 'ios-install':
        return t('settings.pushSub.iosInstall')
      case 'no-plugin':
        return t('settings.pushSub.noPlugin')
      case 'permission-denied':
        return t('settings.pushSub.permissionDenied')
      default:
        return t('settings.pushSub.default')
    }
  })()

  return (
    <PageShell title={t('settings.title')} onBack={back}>
      {me && (
        <Section label={t('settings.account')}>
          <Row
            leading={
              <span className="home-user" aria-hidden="true">
                {displayName.charAt(0).toUpperCase()}
              </span>
            }
            title={displayName}
            subtitle={email}
          />
        </Section>
      )}

      <Section label={t('settings.bots')}>
        <Row
          icon="grid"
          tint="accent"
          title={t('settings.botsTitle')}
          subtitle={t('settings.botsSubtitle')}
          chevron
          onClick={() => forward(`/bots/${encodeURIComponent(principal)}`)}
        />
      </Section>

      <Section label={t('settings.server')}>
        <Row
          icon="bolt"
          tint="accent"
          title={t('settings.serverHealth')}
          subtitle={<StatusDot tone={healthTone} label={probeSummaryLabel(healthTone)} />}
          chevron
          onClick={() => forward('/settings/health')}
        />
      </Section>

      <Section label={t('settings.notifications')}>
        <Row
          icon="bell"
          tint="accent"
          title={t('settings.notifications')}
          subtitle={notifSubtitle}
          trailing={
            <Toggle
              checked={pushOn}
              onChange={next => void setMasterEnabled(next)}
              label={t('settings.notificationsThisDevice')}
            />
          }
        />
        {error && (
          <Row icon="info" tint="warn" title={error} subtitle={t('settings.pushHint')} />
        )}
        {pushOn && (
          <Row
            icon="send"
            tint="accent"
            title={tested ? t('settings.pushTested') : t('settings.pushTest')}
            subtitle={t('settings.pushTestSubtitle')}
            disabled={busy}
            onClick={() => void testPush()}
          />
        )}
      </Section>

      <Section label={t('settings.appearance')}>
        <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
          <div className="segmented" role="radiogroup" aria-label={t('settings.themeAria')}>
            {THEME_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={currentTheme === opt.value}
                className={currentTheme === opt.value ? 'segmented-item active' : 'segmented-item'}
                onClick={() => setTheme(opt.value)}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
          <div className="segmented" role="radiogroup" aria-label={t('settings.languageAria')} style={{ marginTop: 10 }}>
            {LANGUAGE_OPTIONS.map(opt => (
              <LanguageButton key={opt.value} value={opt.value} label={t(opt.labelKey)} />
            ))}
          </div>
        </div>
      </Section>

      {showInstallRow && (
        <Section label={t('settings.app')}>
          <Row
            icon="arrow-up"
            tint="accent"
            title={t('settings.install')}
            subtitle={t('settings.installSubtitle', { app: APP_NAME })}
            chevron
            onClick={() => {
              if (canNativeInstall()) void triggerInstall()
              else setInstallOpen(true)
            }}
          />
        </Section>
      )}

      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} />

      <Section label={t('settings.advanced')}>
        <Disclosure title={t('settings.backendUrl')}>
          <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
            <input
              className="input"
              placeholder={t('settings.backendPlaceholder')}
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
            <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} onClick={() => void onSave()}>
              {saved ? t('common.saved') : t('settings.saveReconnect')}
            </button>
            <p className="faint" style={{ marginTop: 12 }}>
              {t('settings.backendHint')}
            </p>
          </div>
        </Disclosure>
      </Section>
    </PageShell>
  )
}

/** The language segmented button subscribes to the choice atom directly. */
function LanguageButton({ value, label }: { value: LocaleChoice; label: string }) {
  const choice = useStore(localeChoice)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={choice === value}
      className={choice === value ? 'segmented-item active' : 'segmented-item'}
      onClick={() => setLocaleChoice(value)}
    >
      {label}
    </button>
  )
}
