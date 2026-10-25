import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '@nanostores/react'
import { useT } from '../../i18n'
import { ApplyToAllSheet } from '../bots/ApplyToAllSheet'
import { BotScopedScreen } from '../bot-profile/BotScopedScreen'
import { getToolsets, toggleToolset } from '../../lib/hermes/agent-control'
import type { LiveSessionStatus } from '../../lib/hermes/vendor/gateway-contract.generated'
import { Disclosure } from '../../ui/Disclosure'
import { Row, Section } from '../../ui/Section'
import { Skeleton } from '../../ui/Skeleton'
import { StatusDot, type DotTone } from '../../ui/StatusDot'
import { Toggle } from '../../ui/Toggle'
import { ConfirmSheet } from '../vault/ConfirmSheet'
import {
  activeSessions,
  computerUse,
  computerUseError,
  computerUseLoading,
  interruptBusy,
  loadActiveSessions,
  loadComputerUse,
  loadToolsets,
  sessionsError,
  sessionsLoading,
  setToolset,
  stopSession,
  toolsetBusy,
  toolsetError,
  toolsets,
  toolsetsLoading,
} from './store'
import './control.css'

const SESSION_STATUS_KEY: Record<LiveSessionStatus, 'tools.session.idle' | 'tools.session.starting' | 'tools.session.waiting' | 'tools.session.working' | 'tools.session.streaming' | 'tools.session.resuming'> = {
  idle: 'tools.session.idle',
  starting: 'tools.session.starting',
  waiting: 'tools.session.waiting',
  working: 'tools.session.working',
  streaming: 'tools.session.streaming',
  resuming: 'tools.session.resuming',
}

const RUNNING_STATUSES: LiveSessionStatus[] = ['starting', 'waiting', 'working', 'streaming', 'resuming']

function checkTone(status: string): DotTone {
  return status === 'pass' || status === 'ok' ? 'ok' : 'warn'
}

/**
 * Tools (per bot): the computer_use / browser toolset toggles for THIS
 * bot (`/bots/:profile/tools`) plus its tasks in flight, with "Apply to
 * all my bots" for the toggle pair.
 */
export function ToolsPage() {
  const { profile = 'default' } = useParams()
  const t = useT()

  const cu = useStore(computerUse)
  const cuLoading = useStore(computerUseLoading)
  const cuError = useStore(computerUseError)

  const ts = useStore(toolsets)
  const tsLoading = useStore(toolsetsLoading)
  const tsError = useStore(toolsetError)
  const tsBusy = useStore(toolsetBusy)

  const sessions = useStore(activeSessions)
  const sessionsBusy = useStore(sessionsLoading)
  const sessionsFail = useStore(sessionsError)
  const stopping = useStore(interruptBusy)

  const [stopTarget, setStopTarget] = useState('')
  const [applyOpen, setApplyOpen] = useState(false)

  useEffect(() => {
    void loadToolsets(profile)
    void loadComputerUse(profile)
    void loadActiveSessions(profile)
  }, [profile])

  const running = useMemo(
    () => sessions.filter(s => RUNNING_STATUSES.includes(s.status)),
    [sessions],
  )
  const cuRow = ts.find(row => row.name === 'computer_use')
  const browserRow = ts.find(row => row.name === 'browser')

  const cuReady = cu?.ready === true
  const cuDotTone: DotTone = cu == null ? 'neutral' : cuReady ? 'ok' : 'warn'
  const cuDotLabel = cu == null ? t('tools.status.unknown') : cuReady ? t('tools.status.ready') : t('tools.status.needsSetup')

  const cuEnabled = Boolean(cuRow?.enabled)
  const browserEnabled = Boolean(browserRow?.enabled)
  const togglesReady = !tsLoading && !tsError

  return (
    <BotScopedScreen profile={profile} title={t('tools.title')}>
      <Section label={t('tools.computer')}>
        {tsLoading ? (
          <div style={{ padding: 'var(--space-4)' }}>
            <Skeleton height={56} />
            <Skeleton height={56} />
          </div>
        ) : tsError ? (
          <div className="empty">
            <p className="error-text">{tsError}</p>
            <button className="btn" onClick={() => void loadToolsets(profile)}>
              {t('common.retry')}
            </button>
          </div>
        ) : (
          <>
            <Row
              icon="monitor"
              tint="accent"
              title={t('tools.computerControl')}
              subtitle={
                cuLoading ? t('tools.checking') : <StatusDot tone={cuDotTone} label={cuDotLabel} />
              }
              trailing={
                <Toggle
                  checked={cuEnabled}
                  onChange={on => void setToolset(profile, 'computer_use', on)}
                  label={t('tools.computerControl')}
                />
              }
            />
            <Row
              icon="monitor"
              title={t('tools.browser')}
              trailing={
                <Toggle
                  checked={browserEnabled}
                  onChange={on => void setToolset(profile, 'browser', on)}
                  label={t('tools.browser')}
                />
              }
            />
            {tsBusy && <p className="faint" style={{ padding: 'var(--space-2) var(--space-4)' }}>{t('tools.applying')}</p>}
          </>
        )}

        {!cuLoading && cuError && (
          <div className="empty">
            <p className="error-text">{cuError}</p>
            <button className="btn" onClick={() => void loadComputerUse(profile)}>
              {t('common.retry')}
            </button>
          </div>
        )}

        {!cuLoading && cu && (
          <div className="advanced-block">
            <Disclosure title={t('tools.technicalDetails')}>
              <Section>
                {cu.error && (
                  <Row
                    icon="bolt"
                    tint="danger"
                    title={t('tools.error')}
                    subtitle={cu.error}
                  />
                )}
                <Row
                  title={t('tools.driver')}
                  value={cu.installed ? (cu.version ?? t('tools.installed')) : t('tools.notInstalled')}
                  trailing={<StatusDot tone={cu.installed ? 'ok' : 'warn'} />}
                />
                <Row
                  title={t('tools.platform')}
                  value={cu.platform_supported ? t('tools.supports', { platform: cu.platform }) : t('tools.unsupported', { platform: cu.platform })}
                  trailing={<StatusDot tone={cu.platform_supported ? 'ok' : 'warn'} />}
                />
                {cu.checks.map(check => (
                  <Row
                    key={check.label}
                    title={check.label}
                    subtitle={check.message}
                    trailing={<StatusDot tone={checkTone(check.status)} />}
                  />
                ))}
              </Section>
            </Disclosure>
          </div>
        )}
      </Section>

      {togglesReady && (
        <Section>
          <Row
            icon="grid"
            tint="accent"
            title={t('tools.applyAll')}
            subtitle={t('tools.applyAllSub')}
            chevron
            onClick={() => setApplyOpen(true)}
          />
        </Section>
      )}

      <Section label={t('tools.currentTask')}>
        {sessionsBusy ? (
          <div style={{ padding: 'var(--space-4)' }}>
            <Skeleton height={56} />
          </div>
        ) : sessionsFail ? (
          <div className="empty">
            <p className="error-text">{sessionsFail}</p>
            <button className="btn" onClick={() => void loadActiveSessions(profile)}>
              {t('common.retry')}
            </button>
          </div>
        ) : running.length === 0 ? (
          <p className="muted" style={{ padding: 'var(--space-3) var(--space-4)' }}>
            {t('tools.noTasks')}
          </p>
        ) : (
          running.map(session => (
            <Row
              key={session.id}
              title={session.title || t('tools.task')}
              subtitle={
                t(SESSION_STATUS_KEY[session.status]) + (session.model ? ` · ${session.model}` : '')
              }
              trailing={
                <button
                  className="btn btn-danger btn-sm"
                  disabled={stopping === session.id}
                  onClick={() => setStopTarget(session.id)}
                >
                  {stopping === session.id ? '…' : t('common.stop')}
                </button>
              }
            />
          ))
        )}
      </Section>

      <ApplyToAllSheet
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        title={t('tools.applyAll')}
        itemLabel={t('tools.applyAllItem')}
        exclude={profile}
        checkConfigured={async name => {
          const rows = await getToolsets(name)
          const cu = rows.find(r => r.name === 'computer_use')
          const browser = rows.find(r => r.name === 'browser')
          return cu?.enabled === cuEnabled && browser?.enabled === browserEnabled
        }}
        applyOne={async name => {
          await toggleToolset('computer_use', cuEnabled, name)
          await toggleToolset('browser', browserEnabled, name)
        }}
      />

      <ConfirmSheet
        open={stopTarget !== ''}
        onClose={() => setStopTarget('')}
        title={t('tools.stopTask')}
        body={t('tools.stopTaskBody')}
        confirmLabel={t('common.stop')}
        busy={stopping !== ''}
        onConfirm={() => {
          const id = stopTarget
          setStopTarget('')
          void stopSession(profile, id)
        }}
      />
    </BotScopedScreen>
  )
}
