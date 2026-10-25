import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '@nanostores/react'
import { useT } from '../../i18n'
import { ApplyToAllSheet } from '../bots/ApplyToAllSheet'
import { BotScopedScreen } from '../bot-profile/BotScopedScreen'
import { getConfig, readApprovalMode, setApprovalMode, type ApprovalMode } from '../../lib/hermes/agent-control'
import { Section } from '../../ui/Section'
import { Skeleton } from '../../ui/Skeleton'
import { approvalError, approvalLoading, approvalMode, approvalSaving, loadApproval, saveApproval } from './store'
import './control.css'

const APPROVAL_OPTIONS: { mode: ApprovalMode; labelKey: 'approvals.mode.manual' | 'approvals.mode.smart' | 'approvals.mode.off' }[] = [
  { mode: 'manual', labelKey: 'approvals.mode.manual' },
  { mode: 'smart', labelKey: 'approvals.mode.smart' },
  { mode: 'off', labelKey: 'approvals.mode.off' },
]

const MODE_HINT_KEYS: Record<ApprovalMode, 'approvals.hints.manual' | 'approvals.hints.smart' | 'approvals.hints.off'> = {
  manual: 'approvals.hints.manual',
  smart: 'approvals.hints.smart',
  off: 'approvals.hints.off',
}

/**
 * Approvals (per bot): the approvals.mode segmented control for THIS bot
 * (`/bots/:profile/approvals`), with "Apply this mode to all my bots".
 */
export function ApprovalsPage() {
  const { profile = 'default' } = useParams()
  const mode = useStore(approvalMode)
  const busy = useStore(approvalLoading)
  const fail = useStore(approvalError)
  const pending = useStore(approvalSaving)
  const [applyOpen, setApplyOpen] = useState(false)
  const t = useT()

  useEffect(() => {
    void loadApproval(profile)
  }, [profile])

  return (
    <BotScopedScreen profile={profile} title={t('approvals.title')}>
      <Section label={t('approvals.risky')}>
        {busy ? (
          <div style={{ padding: 'var(--space-4)' }}>
            <Skeleton height={72} />
          </div>
        ) : fail ? (
          <div className="empty">
            <p className="error-text">{fail}</p>
            <button className="btn" onClick={() => void loadApproval(profile)}>
              {t('common.retry')}
            </button>
          </div>
        ) : (
          <div className="control-auto">
            <div className="control-row-title">{t('approvals.riskyTitle')}</div>
            <div className="faint">{t('approvals.riskySub')}</div>
            <div className="control-hint">{mode ? t(MODE_HINT_KEYS[mode]) : ''}</div>
            <div className="segmented" role="radiogroup" aria-label={t('approvals.modeAria')}>
              {APPROVAL_OPTIONS.map(opt => (
                <button
                  key={opt.mode}
                  type="button"
                  role="radio"
                  aria-checked={mode === opt.mode}
                  className={mode === opt.mode ? 'segmented-item active' : 'segmented-item'}
                  disabled={pending}
                  onClick={() => void saveApproval(profile, opt.mode)}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
            {pending && <span className="faint">{t('common.saving')}</span>}
            <button className="btn btn-block" onClick={() => setApplyOpen(true)}>
              {t('approvals.applyAll')}
            </button>
          </div>
        )}
      </Section>

      <ApplyToAllSheet
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        title={t('approvals.applyAll')}
        itemLabel={t('approvals.applyAllItem')}
        exclude={profile}
        checkConfigured={async name => readApprovalMode(await getConfig(name)) === mode}
        applyOne={async name => {
          await setApprovalMode(mode ?? 'smart', name)
        }}
      />
    </BotScopedScreen>
  )
}
