import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '@nanostores/react'
import { useBack } from '../../app/transition'
import { useT } from '../../i18n'
import { PageShell } from '../../ui/PageShell'
import { Section } from '../../ui/Section'
import { Skeleton } from '../../ui/Skeleton'
import { formatDateTime, formatRunTime, scheduleText } from './format'
import { deleteJob, detailError, detailJob, detailLoading, detailRuns, loadJobDetail, resetDetail, triggerJob } from './store'
import './index.css'

export function RoutineDetailPage() {
  const { profile = 'default', id = '' } = useParams()
  const back = useBack(`/bots/${encodeURIComponent(profile)}/routines`)
  const job = useStore(detailJob)
  const runs = useStore(detailRuns)
  const loading = useStore(detailLoading)
  const error = useStore(detailError)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t = useT()

  useEffect(() => {
    void loadJobDetail(profile, id)
    return () => {
      resetDetail()
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
    }
  }, [profile, id])

  async function onRunNow() {
    if (running) return
    setRunning(true)
    setRunError('')
    try {
      await triggerJob(profile, id)
      await loadJobDetail(profile, id)
    } catch (e) {
      setRunError(e instanceof Error ? e.message : t('routines.runFailed'))
    } finally {
      setRunning(false)
    }
  }

  async function onDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      confirmTimer.current = setTimeout(() => setConfirmingDelete(false), 4000)
      return
    }
    try {
      await deleteJob(profile, id)
      back()
    } catch (e) {
      setRunError(e instanceof Error ? e.message : t('routines.deleteFailed'))
      setConfirmingDelete(false)
    }
  }

  const title = job?.name || id
  const schedule = job ? scheduleText(job) : ''
  const rawSchedule =
    typeof job?.schedule === 'string' ? job.schedule : job?.schedule?.expr ?? job?.schedule_display ?? ''

  return (
    <PageShell title={title} onBack={back}>
      {loading && (
        <div className="list">
          <span className="card">
            <Skeleton height={96} />
          </span>
          <span className="card">
            <Skeleton height={48} />
          </span>
        </div>
      )}

      {!loading && error && (
        <div className="empty">
          <p className="error-text">{error}</p>
        </div>
      )}

      {!loading && !error && job && (
        <>
          <Section>
            <div className="card detail-card">
              {job.prompt && <p className="detail-prompt">{job.prompt}</p>}
              <div className="detail-grid">
                <span className="detail-label">{t('routines.schedule')}</span>
                <span>{schedule}</span>
                {rawSchedule && rawSchedule !== schedule && (
                  <>
                    <span className="detail-label">{t('routines.expression')}</span>
                    <span className="detail-mono">{rawSchedule}</span>
                  </>
                )}
                <span className="detail-label">{t('routines.nextRun')}</span>
                <span>{formatDateTime(job.next_run_at)}</span>
                {job.last_run_at !== null && job.last_run_at !== undefined && (
                  <>
                    <span className="detail-label">{t('routines.lastRun')}</span>
                    <span>{formatDateTime(job.last_run_at)}</span>
                  </>
                )}
                {job.state && (
                  <>
                    <span className="detail-label">{t('routines.state')}</span>
                    <span>{job.state}</span>
                  </>
                )}
              </div>
              {runError && <p className="error-text">{runError}</p>}
              <div className="detail-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  disabled={running}
                  onClick={() => void onRunNow()}
                >
                  {running ? t('routines.running') : t('routines.runNow')}
                </button>
                <button
                  type="button"
                  className={`btn btn-block${confirmingDelete ? ' btn-danger' : ''}`}
                  onClick={() => void onDelete()}
                >
                  {confirmingDelete ? t('routines.confirmDelete') : t('common.delete')}
                </button>
              </div>
            </div>
          </Section>

          <Section label={t('routines.lastRuns')}>
            {runs.length === 0 ? (
              <p className="muted" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                {t('routines.noRuns')}
              </p>
            ) : (
              runs.map(run => (
                <div key={run.id} className="card run-card" style={{ marginBottom: 8 }}>
                  <div className="row">
                    <span className="run-title">
                      {run.is_active && <span className="chip warn">{t('routines.inProgress')}</span>} {run.title || t('routines.run')}
                    </span>
                    <span className="spacer" />
                    <span className="faint">{formatDateTime(run.started_at)}</span>
                  </div>
                  {run.preview && <p className="run-preview">{run.preview}</p>}
                  {run.started_at !== undefined && (
                    <span className="faint">
                      {run.ended_at !== null && run.ended_at !== undefined
                        ? formatRunTime(run.ended_at - run.started_at)
                        : t('routines.durationDash')}
                    </span>
                  )}
                </div>
              ))
            )}
          </Section>
        </>
      )}
    </PageShell>
  )
}
