import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '@nanostores/react'
import { useBack, useSlideNavigate } from '../../app/transition'
import { useT } from '../../i18n'
import { EmptyState } from '../../ui/EmptyState'
import { Icon } from '../../ui/Icon'
import { IconButton } from '../../ui/IconButton'
import { PageShell } from '../../ui/PageShell'
import { Row, Section } from '../../ui/Section'
import { Skeleton } from '../../ui/Skeleton'
import { Toggle } from '../../ui/Toggle'
import { NewRoutineSheet } from './NewRoutineSheet'
import { scheduleText } from './format'
import {
  jobs,
  loadRoutines,
  routinesError,
  routinesLoading,
  setJobPaused,
  setWebhookEnabled,
  webhooks,
  webhooksEnabled,
} from './store'
import type { CronJob, WebhookRoute } from './types'
import './index.css'

export function RoutinesPage() {
  const { profile = 'default' } = useParams()
  const back = useBack('/')
  const { forward } = useSlideNavigate()
  const jobList = useStore(jobs)
  const webhookList = useStore(webhooks)
  const webhookPlatform = useStore(webhooksEnabled)
  const loading = useStore(routinesLoading)
  const error = useStore(routinesError)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [busyId, setBusyId] = useState('')
  const t = useT()

  useEffect(() => {
    void loadRoutines(profile)
  }, [profile])

  async function onToggleJob(job: CronJob, paused: boolean) {
    if (busyId) return
    setBusyId(`cron:${job.id}`)
    try {
      await setJobPaused(profile, job, paused)
    } catch {
      // keep the row as-is; the next refresh shows the real state
    } finally {
      setBusyId('')
    }
  }

  async function onToggleWebhook(webhook: WebhookRoute, enabled: boolean) {
    if (busyId) return
    setBusyId(`webhook:${webhook.name}`)
    try {
      await setWebhookEnabled(profile, webhook.name, enabled)
    } catch {
      // keep the row as-is
    } finally {
      setBusyId('')
    }
  }

  function isPausedJob(job: CronJob): boolean {
    return job.state === 'paused' || !job.enabled
  }

  return (
    <PageShell
      title={t('routines.title')}
      onBack={back}
      actions={
        <IconButton icon="plus" variant="glass" label={t('routines.new')} onClick={() => setSheetOpen(true)} />
      }
    >
      {loading && (
        <div className="list">
          {[0, 1, 2].map(i => (
            <span key={i} className="card">
              <Skeleton height={52} />
            </span>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="empty">
          <p className="error-text">{error}</p>
        </div>
      )}

      {!loading && !error && jobList.length === 0 && webhookList.length === 0 && (
        <EmptyState
          icon={<Icon name="calendar" size={30} />}
          title={t('routines.emptyTitle')}
          text={t('routines.emptyText')}
          actionLabel={t('routines.create')}
          onAction={() => setSheetOpen(true)}
        />
      )}

      {jobList.length > 0 && (
        <Section label={t('routines.title')}>
          {jobList.map(job => {
            const paused = isPausedJob(job)
            const name = job.name || job.id
            return (
              <Row
                key={job.id}
                icon="calendar"
                tint="accent"
                title={name}
                subtitle={`${scheduleText(job)}${paused ? t('routines.paused') : ''}`}
                trailing={
                  <Toggle
                    checked={!paused}
                    onChange={on => void onToggleJob(job, !on)}
                    label={paused ? t('routines.resumeLabel', { name }) : t('routines.pauseLabel', { name })}
                  />
                }
                onClick={() =>
                  forward(`/bots/${encodeURIComponent(profile)}/routines/${encodeURIComponent(job.id)}`)
                }
              />
            )
          })}
        </Section>
      )}

      {webhookList.length > 0 && (
        <Section label={t('routines.webhooks')}>
          {!webhookPlatform && (
            <p className="faint" style={{ padding: 'var(--space-1) var(--space-1)' }}>
              {t('routines.webhooksOff')}
            </p>
          )}
          {webhookList.map(webhook => {
            const paused = !webhook.enabled
            return (
              <Row
                key={webhook.name}
                icon="bolt"
                tint="accent"
                title={webhook.name}
                subtitle={`${t('routines.webhookSub')}${paused ? t('routines.paused') : ''}`}
                trailing={
                  <Toggle
                    checked={webhook.enabled}
                    onChange={on => void onToggleWebhook(webhook, on)}
                    label={paused ? t('routines.activateLabel', { name: webhook.name }) : t('routines.pauseLabel', { name: webhook.name })}
                  />
                }
              />
            )
          })}
        </Section>
      )}

      {sheetOpen && (
        <NewRoutineSheet
          open={sheetOpen}
          profile={profile}
          onClose={() => setSheetOpen(false)}
          onCreated={() => {
            setSheetOpen(false)
            void loadRoutines(profile)
          }}
        />
      )}
    </PageShell>
  )
}
