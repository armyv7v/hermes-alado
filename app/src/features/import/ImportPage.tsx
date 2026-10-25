import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useStore } from '@nanostores/react'
import { APP_NAME } from '../../app/brand'
import { useBack, useSlideNavigate } from '../../app/transition'
import { useT, useTp } from '../../i18n'
import { EXPORT_PROMPT } from '../../lib/import/export-prompt'
import type { ImportPlan, PlannedBot } from '../../lib/import/plan'
import { buildImportPlan, profileSlug, uniqueSlug } from '../../lib/import/plan'
import { parseImportDoc, type ParseResult } from '../../lib/import/parse'
import './import.css'
import { Icon } from '../../ui/Icon'
import { PageShell } from '../../ui/PageShell'
import { Section } from '../../ui/Section'
import { StatusDot } from '../../ui/StatusDot'
import { Toggle } from '../../ui/Toggle'
import { activeProfile, featuredBotName, homeBots } from '../home/store'
import { chatSessionId, sendMessage, setPendingDraft } from '../chat/store'
import { cronToSpanish } from '../../lib/hermes/cron-spanish'
import {
  importItems,
  importRunning,
  importSummary,
  resetImport,
  runImport,
} from './store'

type Step = 1 | 2 | 3 | 4

type BotChoice = 'use' | 'create'

/** IDs for toggles: bots by original name, routines/groups by index. */
const botUid = (name: string) => `b:${name}`
const groupUid = (index: number) => `g:${index}`
const routineUid = (index: number) => `r:${index}`

export function ImportPage() {
  const back = useBack('/')
  const { forward } = useSlideNavigate()
  const bots = useStore(homeBots)
  const items = useStore(importItems)
  const running = useStore(importRunning)
  const summary = useStore(importSummary)
  const t = useT()

  const [step, setStep] = useState<Step>(1)
  const [pasted, setPasted] = useState('')
  const [copied, setCopied] = useState(false)
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [choices, setChoices] = useState<Record<string, BotChoice>>({})
  const [enabled, setEnabled] = useState<Record<string, boolean>>({})
  const [scheduleEdits, setScheduleEdits] = useState<Record<number, string>>({})
  const [fileError, setFileError] = useState('')
  const startedRef = useRef(false)

  const existing = useMemo(
    () => bots.map(b => ({ name: b.name, displayName: b.displayName })),
    [bots],
  )

  // The plan is rebuilt whenever the roster changes so conflict detection
  // stays in sync. Conflict choices live here and apply to the effective plan.
  const plan = useMemo<ImportPlan | null>(() => {
    if (!parsed) return null
    return buildImportPlan(parsed, existing)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, bots])

  const principal = featuredBotName() ?? activeProfile.get() ?? 'default'
  const principalLabel = bots.find(b => b.name === principal)?.displayName ?? principal

  useEffect(() => {
    if (step !== 4 || !plan || startedRef.current) return
    startedRef.current = true
    resetImport()
    void runImport(effectivePlan(plan, enabled, choices, scheduleEdits), principal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(EXPORT_PROMPT)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // non-secure context: the prompt is a selectable block below
    }
  }

  function onPasteNext() {
    if (!pasted.trim()) return
    setParsed(parseImportDoc(pasted))
    setStep(3)
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFileError('')
    try {
      setPasted(await file.text())
      setStep(2)
    } catch {
      setFileError(t('import.fileReadFailed'))
    }
  }

  function onFallback() {
    const message = `${t('import.fallbackMessage')}

\`\`\`
${pasted.trim()}
\`\`\``
    setPendingDraft(message)
    forward(`/chat/${encodeURIComponent(principal)}`)
    // Prefill + send: fire once the chat session exists, drop it if it takes too long.
    const deadline = Date.now() + 4000
    const timer = setInterval(() => {
      if (chatSessionId()) {
        clearInterval(timer)
        void sendMessage(message)
      } else if (Date.now() > deadline) {
        clearInterval(timer)
      }
    }, 250)
  }

  const counts = useMemo(() => {
    if (!parsed) return { bots: 0, groups: 0, routines: 0 }
    return {
      bots: parsed.bots.length,
      groups: parsed.groups.length,
      routines: parsed.routines.length,
    }
  }, [parsed])

  const little = plan === null || (counts.bots + counts.groups + counts.routines) === 0

  return (
    <PageShell
      title={t('import.title')}
      onBack={step === 4 && running ? undefined : back}
    >
      {step === 1 && (
        <StepOne
          copied={copied}
          onCopy={() => void onCopy()}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <StepTwo
          pasted={pasted}
          fileError={fileError}
          onChange={setPasted}
          onFile={e => void onFile(e)}
          onNext={onPasteNext}
        />
      )}

      {step === 3 && plan && parsed && (
        <StepThree
          plan={plan}
          counts={counts}
          chunks={parsed.chunks}
          principal={principalLabel}
          choices={choices}
          enabled={enabled}
          scheduleEdits={scheduleEdits}
          little={little}
          onChoice={(name, choice) => setChoices(c => ({ ...c, [name]: choice }))}
          onToggle={(uid, on) => setEnabled(en => ({ ...en, [uid]: on }))}
          onSchedule={(index, text) => setScheduleEdits(s => ({ ...s, [index]: text }))}
          onFallback={onFallback}
          onCreate={() => {
            startedRef.current = false
            setStep(4)
          }}
        />
      )}

      {step === 4 && <StepFour items={items} running={running} summary={summary} onHome={() => forward('/')} />}
    </PageShell>
  )
}

function effectivePlan(
  plan: ImportPlan,
  enabled: Record<string, boolean>,
  choices: Record<string, BotChoice>,
  scheduleEdits: Record<number, string>,
): ImportPlan {
  const taken = new Set<string>()
  for (const profile of plan.nameMap.keys()) taken.add(profile)

  const bots: PlannedBot[] = plan.bots
    .filter(bot => enabled[botUid(bot.originalName)] !== false)
    .map(bot => {
      if (!bot.conflict) return bot
      const choice = choices[bot.originalName] ?? 'use'
      if (choice === 'use') return bot
      const slug = uniqueSlug(profileSlug(bot.originalName), taken)
      taken.add(slug)
      return { ...bot, slug, useExisting: '' }
    })

  const routines = plan.routines
    .filter((_, index) => enabled[routineUid(index)] !== false)
    .map((routine, index) => ({
      ...routine,
      scheduleText:
        scheduleEdits[index]?.trim() ?? routine.scheduleText,
    }))

  const groups = plan.groups.filter((_, index) => enabled[groupUid(index)] !== false)

  // Rebuild the name map with the final bot resolution.
  const nameMap = new Map<string, string>()
  for (const [key, value] of plan.nameMap) nameMap.set(key, value)
  for (const bot of bots) {
    nameMap.set(bot.originalName.trim().toLowerCase(), bot.slug ?? bot.useExisting)
  }

  return { bots, groups, routines, nameMap }
}

// ── step 1: ask the old app ───────────────────────────────────────────────

function StepOne({
  copied,
  onCopy,
  onNext,
}: {
  copied: boolean
  onCopy: () => void
  onNext: () => void
}) {
  const t = useT()
  return (
    <>
      <p className="page-subtitle">
        {t('import.subtitle', { app: APP_NAME })}
      </p>
      <Section label={t('import.stepCopy')}>
        <pre className="import-prompt">{EXPORT_PROMPT}</pre>
      </Section>
      <button className="btn btn-primary btn-block" onClick={onCopy}>
        <Icon name="copy" size={18} />
        {copied ? t('import.copied') : t('import.copyMessage')}
      </button>
      <p className="faint" style={{ marginTop: 10, textAlign: 'center' }}>
        {t('import.pasteHint')}
      </p>
      <button className="btn btn-block" style={{ marginTop: 10 }} onClick={onNext}>
        {t('import.haveAnswer')}
      </button>
    </>
  )
}

// ── step 2: paste ─────────────────────────────────────────────────────────

function StepTwo({
  pasted,
  fileError,
  onChange,
  onFile,
  onNext,
}: {
  pasted: string
  fileError: string
  onChange: (text: string) => void
  onFile: (e: ChangeEvent<HTMLInputElement>) => void
  onNext: () => void
}) {
  const t = useT()
  return (
    <>
      <p className="page-subtitle">{t('import.stepPaste')}</p>
      <textarea
        className="input import-paste"
        placeholder={t('import.pastePlaceholder')}
        value={pasted}
        onChange={e => onChange(e.target.value)}
      />
      <div className="import-upload-row">
        <button className="btn" onClick={() => document.getElementById('import-file')?.click()}>
          <Icon name="upload" size={18} />
          {t('import.uploadMd')}
        </button>
        <input
          id="import-file"
          type="file"
          accept=".md,.txt,text/markdown,text/plain"
          hidden
          onChange={onFile}
        />
        {fileError && <p className="error-text">{fileError}</p>}
      </div>
      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 12 }}
        disabled={!pasted.trim()}
        onClick={onNext}
      >
        {t('import.continue')}
      </button>
    </>
  )
}

// ── step 3: preview ───────────────────────────────────────────────────────

function StepThree({
  plan,
  counts,
  chunks,
  principal,
  choices,
  enabled,
  scheduleEdits,
  little,
  onChoice,
  onToggle,
  onSchedule,
  onFallback,
  onCreate,
}: {
  plan: ImportPlan
  counts: { bots: number; groups: number; routines: number }
  chunks: { text: string }[]
  principal: string
  choices: Record<string, BotChoice>
  enabled: Record<string, boolean>
  scheduleEdits: Record<number, string>
  little: boolean
  onChoice: (name: string, choice: BotChoice) => void
  onToggle: (uid: string, on: boolean) => void
  onSchedule: (index: number, text: string) => void
  onFallback: () => void
  onCreate: () => void
}) {
  const t = useT()
  const tp = useTp()
  const creating =
    plan.bots.filter(
      bot =>
        enabled[botUid(bot.originalName)] !== false &&
        (bot.slug !== null ||
          (bot.conflict && (choices[bot.originalName] ?? 'use') === 'create')),
    ).length +
    plan.routines.filter((_, i) => enabled[routineUid(i)] !== false).length +
    plan.groups.filter((_, i) => enabled[groupUid(i)] !== false).length

  return (
    <>
      <p className="page-subtitle">
        {t('import.creatingLine', {
          bots: `${counts.bots} ${tp('import.nounBots', counts.bots)}`,
          groups: `${counts.groups} ${tp('import.nounGroups', counts.groups)}`,
          routines: `${counts.routines} ${tp('import.nounRoutines', counts.routines)}`,
        })}
      </p>

      {plan.bots.length > 0 && (
        <Section label={t('import.sections.bots')}>
          {plan.bots.map(bot => {
            const uid = botUid(bot.originalName)
            const on = enabled[uid] !== false
            return (
              <div key={uid} className="import-card">
                <div className="import-card-head">
                  <span className="import-card-title">{bot.originalName}</span>
                  <Toggle checked={on} onChange={next => onToggle(uid, next)} label={t('import.include', { name: bot.originalName })} />
                </div>
                {bot.soul.trim() && (
                  <p className="import-card-soul">{bot.soul.trim().slice(0, 140)}{bot.soul.trim().length > 140 ? '…' : ''}</p>
                )}
                {bot.conflict && (
                  <div className="import-conflict">
                    <p className="warn-text">
                      {t('import.conflictExists', { name: bot.originalName })}
                    </p>
                    <div className="segmented">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={choices[bot.originalName] !== 'create'}
                        className={(choices[bot.originalName] ?? 'use') === 'use' ? 'segmented-item active' : 'segmented-item'}
                        onClick={() => onChoice(bot.originalName, 'use')}
                      >
                        {t('import.useExisting')}
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={choices[bot.originalName] === 'create'}
                        className={choices[bot.originalName] === 'create' ? 'segmented-item active' : 'segmented-item'}
                        onClick={() => onChoice(bot.originalName, 'create')}
                      >
                        {t('import.createAs', { slug: uniqueSlug(profileSlug(bot.originalName), new Set([profileSlug(bot.originalName)])) })}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </Section>
      )}

      {plan.groups.length > 0 && (
        <Section label={t('import.sections.groups')}>
          {plan.groups.map((group, index) => {
            const uid = groupUid(index)
            const on = enabled[uid] !== false
            const badMembers = group.members.length < 2
            return (
              <div key={uid} className="import-card">
                <div className="import-card-head">
                  <span className="import-card-title">{group.name}</span>
                  <Toggle checked={on} onChange={next => onToggle(uid, next)} label={t('import.include', { name: group.name })} />
                </div>
                <p className="import-card-soul">{group.members.join(', ') || t('import.noMembers')}</p>
                {badMembers && <p className="warn-text">{t('import.needsTwoMembers')}</p>}
              </div>
            )
          })}
        </Section>
      )}

      {plan.routines.length > 0 && (
        <Section label={t('import.sections.routines')}>
          {plan.routines.map((routine, index) => {
            const uid = routineUid(index)
            const on = enabled[uid] !== false
            const conf = routine.schedule.confidence
            const needsCheck = conf !== 'exact' || routine.schedule.kind === 'none'
            const shown = routine.schedule.kind === 'cron' && routine.schedule.schedule
              ? cronToSpanish(routine.schedule.schedule)
              : routine.schedule.kind === 'interval'
                ? routine.when
                : ''
            return (
              <div key={uid} className="import-card">
                <div className="import-card-head">
                  <span className="import-card-title">{routine.name}</span>
                  <Toggle checked={on} onChange={next => onToggle(uid, next)} label={t('import.include', { name: routine.name })} />
                </div>
                <p className="import-card-soul">
                  {routine.bot ? t('import.botPrefix', { bot: routine.bot }) : ''}
                  {shown || t('import.unrecognizedSchedule')}
                </p>
                {needsCheck && (
                  <div className="import-schedule-edit">
                    <p className="warn-text">{t('import.confirmSchedule')}</p>
                    <input
                      className="input"
                      value={scheduleEdits[index] ?? routine.when}
                      placeholder={t('import.scheduleExample')}
                      onChange={e => onSchedule(index, e.target.value)}
                    />
                  </div>
                )}
                {!routine.bot && <p className="warn-text">{t('import.noBotAssigned')}</p>}
              </div>
            )
          })}
        </Section>
      )}

      {chunks.length > 0 && (
        <Section label={t('import.ignoredChunks')}>
          {chunks.map((chunk, index) => (
            <p key={index} className="import-chunk" style={{ padding: 'var(--space-3) var(--space-4)' }}>
              {chunk.text.slice(0, 160)}
            </p>
          ))}
        </Section>
      )}

      <button
        className="btn btn-primary btn-block"
        disabled={creating === 0}
        onClick={onCreate}
      >
        {t('import.createAll')}
      </button>

      <button className="btn btn-block" style={{ marginTop: 8 }} onClick={onFallback}>
        {little
          ? t('import.letBotSort', { name: principal })
          : t('import.preferBotSort', { name: principal })}
      </button>
    </>
  )
}

// ── step 4: progress + summary ────────────────────────────────────────────

function StepFour({
  items,
  running,
  summary,
  onHome,
}: {
  items: { id: string; label: string; state: string; error: string }[]
  running: boolean
  summary: { bots: number; routines: number; groups: number; failed: number; failures: string[] } | null
  onHome: () => void
}) {
  const t = useT()
  const tp = useTp()
  const done = summary !== null
  return (
    <>
      <Section label={done ? t('import.result') : t('import.creating')}>
        {items.map(item => (
          <div key={item.id} className="import-progress-row">
            <StatusDot
              tone={item.state === 'failed' ? 'danger' : item.state === 'done' ? 'ok' : item.state === 'running' ? 'warn' : 'neutral'}
              ariaLabel={item.state}
            />
            <span className="import-progress-label">{item.label}</span>
            {item.error && <span className="faint">{item.error}</span>}
          </div>
        ))}
        {running && items.length === 0 && <p className="muted" style={{ padding: 'var(--space-3)' }}>{t('import.preparing')}</p>}
      </Section>

      {done && summary && (
        <>
          <Section label={t('import.done')}>
            <p className="import-summary">
              {t('import.createdSummary', {
                bots: `${summary.bots} ${tp('import.nounBots', summary.bots)}`,
                routines: `${summary.routines} ${tp('import.nounRoutines', summary.routines)}`,
                groups: `${summary.groups} ${tp('import.nounGroups', summary.groups)}`,
              })}
              {summary.failed > 0 && (
                <span className="error-text" style={{ display: 'block', marginTop: 8 }}>
                  {tp('import.failedSteps', summary.failed)}
                </span>
              )}
            </p>
          </Section>
          <button className="btn btn-primary btn-block" onClick={onHome}>
            {t('import.goHome')}
          </button>
        </>
      )}
    </>
  )
}
