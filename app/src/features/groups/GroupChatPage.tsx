import './groups.css'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '@nanostores/react'
import { useBack } from '../../app/transition'
import { useT } from '../../i18n'
import { groupEngine, type GroupApprovalChoice, type GroupPendingAction, type RoomDriverStatus, type RoomMember } from '../../lib/hermes/groups'
import { AvatarStack } from '../../ui/Avatar'
import { EmptyState } from '../../ui/EmptyState'
import { IconButton } from '../../ui/IconButton'
import { Sheet } from '../../ui/Sheet'
import { Skeleton } from '../../ui/Skeleton'
import { ensureAppearances } from '../bots/appearance-store'
import { GroupComposer } from './GroupComposer'
import { GroupMessages } from './GroupMessages'
import { memberName, memberPhases, memberProfile } from './members'
import { refreshGroupRoom, toPendingAction, useGroupRoom } from './room-store'
import { ensureGroupsCapability, groupsAvailable } from './store'

/** "Pancho is typing… / is working" from `driver_status.member_activity`;
 *  older gateways without the list still say the group is working. */
function GroupActivityLine({ driver, members }: { driver: RoomDriverStatus | null; members: RoomMember[] }) {
  const phases = memberPhases(driver)
  const t = useT()
  const parts: string[] = []
  for (const member of members) {
    const phase = phases.get(member.member_id ?? '')
    if (!phase) continue
    parts.push(phase === 'working' ? t('groups.typing', { name: memberName(member) }) : t('groups.memberWorking', { name: memberName(member) }))
  }
  if (!parts.length && driver?.working) parts.push(t('groups.groupWorking'))
  if (!parts.length) return null
  return (
    <div className="group-activity" role="status">
      <span className="group-activity-dot" aria-hidden="true" />
      <span>{parts.join(' · ')}</span>
    </div>
  )
}

function GroupActionCards({
  roomId,
  driver,
  members,
  busy,
  onActed,
}: {
  roomId: string
  driver: RoomDriverStatus | null
  members: RoomMember[]
  busy: boolean
  onActed: (error?: string) => void
}) {
  const [acting, setActing] = useState(false)
  const t = useT()
  const actions = (driver?.pending_actions ?? []).map(toPendingAction).filter(a => a.kind === 'approval' || a.kind === 'retry')
  if (actions.length === 0) return null

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    if (busy || acting) return
    setActing(true)
    try {
      await fn()
      await refreshGroupRoom(roomId, true)
      onActed()
    } catch (e) {
      onActed(e instanceof Error ? e.message : t('groups.actionFailed'))
    } finally {
      setActing(false)
    }
  }

  const approve = (action: GroupPendingAction, choice: GroupApprovalChoice): Promise<void> =>
    run(() => groupEngine.approve(roomId, action, choice))

  const retry = (action: GroupPendingAction): Promise<void> =>
    run(() => groupEngine.retry(roomId, action.task_id ?? ''))

  const requester = (action: GroupPendingAction): string =>
    memberName(members.find(m => m.member_id === action.member_id)) || t('groups.aMember')

  // Same card style as the chat approval cards (`.request-card`).
  return (
    <div className="group-actions">
      {actions.map(action => (
        <div className="request-card" key={`${action.kind}:${action.task_id}:${action.execution_generation}`}>
          <div className="request-card-head">
            <span className="request-card-title">
              {action.kind === 'approval' ? t('chat.approvalTitle') : t('groups.interruptedTask')}
            </span>
            <span className="faint">
              {action.kind === 'approval' ? requester(action) : t('groups.indeterminateTask')}
            </span>
          </div>
          {action.kind === 'approval' && (
            <p className="request-card-desc">{t('groups.approvalAsked', { requester: requester(action) })}</p>
          )}
          <div className="request-card-actions">
            {action.kind === 'approval' && (
              <>
                <button className="btn btn-primary" disabled={busy || acting} onClick={() => void approve(action, 'once')}>
                  {t('chat.approvals.once')}
                </button>
                <button className="btn btn-danger" disabled={busy || acting} onClick={() => void approve(action, 'deny')}>
                  {t('chat.approvals.deny')}
                </button>
              </>
            )}
            {action.kind === 'retry' && (
              <button className="btn btn-primary" disabled={busy || acting} onClick={() => void retry(action)}>
                {t('common.retry')}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export function GroupChatPage() {
  const { roomId = '' } = useParams()
  const back = useBack('/')
  const { room, driver, events, loading, error } = useGroupRoom(roomId || undefined)
  const available = useStore(groupsAvailable)
  const t = useT()
  const [menuOpen, setMenuOpen] = useState(false)
  const [rename, setRename] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [confirmingDisband, setConfirmingDisband] = useState(false)

  useEffect(() => {
    ensureAppearances()
    void ensureGroupsCapability()
  }, [])

  const memberProfiles = (room?.members ?? []).map(memberProfile).filter(Boolean)
  const driverReady = Boolean(driver)

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    if (busy) return
    setBusy(true)
    setActionError('')
    try {
      await fn()
      await refreshGroupRoom(roomId, true)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t('groups.completeFailed'))
    } finally {
      setBusy(false)
    }
  }

  const stopRound = (): Promise<void> => run(() => groupEngine.stop(roomId))

  const renameRoom = async (): Promise<void> => {
    if (!rename.trim()) return
    await run(() => groupEngine.rename(roomId, rename))
    setRename('')
  }

  const disbandRoom = (): Promise<void> => run(() => groupEngine.disband(roomId))

  if (available === false) {
    return (
      <div className="group-page">
        <header className="group-header">
          <IconButton icon="back" variant="ghost" label={t('common.back')} onClick={back} />
        </header>
        <EmptyState
          title={t('groups.unavailableTitle')}
          text={t('groups.unavailableBody')}
        />
      </div>
    )
  }

  return (
    <div className="group-page">
      <header className="group-header">
        <IconButton icon="back" variant="ghost" label={t('common.back')} onClick={back} />
        <div className="group-header-pill glass">
          {memberProfiles.length > 0 && <AvatarStack names={memberProfiles} size="xs" max={3} />}
          <span className="group-header-name">{room?.name ?? '…'}</span>
        </div>
        <IconButton icon="more" variant="ghost" label={t('common.more')} onClick={() => setMenuOpen(true)} />
      </header>

      <GroupActivityLine driver={driver} members={room?.members ?? []} />

      {room && !driver && !loading && (
        <div className="group-activity">
          <span>{t('groups.driverOff')}</span>
        </div>
      )}

      {error && events.length === 0 && !loading ? (
        <div className="empty">
          <p className="error-text">{error}</p>
          <button className="btn" onClick={() => void refreshGroupRoom(roomId, true).catch(() => undefined)}>
            {t('common.retry')}
          </button>
        </div>
      ) : loading ? (
        <div className="group-messages" aria-hidden="true">
          <Skeleton width="60%" />
          <Skeleton width="80%" />
          <Skeleton width="40%" />
        </div>
      ) : (
        <GroupMessages events={events} members={room?.members ?? []} />
      )}

      {actionError && <div className="group-actions"><div className="error-text">{actionError}</div></div>}

      <GroupActionCards roomId={roomId} driver={driver} members={room?.members ?? []} busy={busy} onActed={msg => setActionError(msg ?? '')} />

      {driverReady && driver?.running && (
        <div className="group-actions">
          <button className="btn btn-sm" disabled={busy} onClick={() => void stopRound()}>
            {t('groups.stopRound')}
          </button>
        </div>
      )}

      <GroupComposer
        roomId={roomId}
        roomName={room?.name}
        members={room?.members ?? []}
        disabled={!driverReady || loading}
      />

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={room?.name ?? t('groups.group')}>
        {memberProfiles.length > 0 && (
          <div className="row" style={{ marginBottom: 12 }}>
            <AvatarStack names={memberProfiles} size="md" max={3} />
            <span className="muted">{t('groups.members', { count: memberProfiles.length })}</span>
          </div>
        )}
        <label className="faint">{t('groups.rename')}</label>
        <input
          className="input"
          style={{ marginTop: 6 }}
          placeholder={room?.name ?? t('groups.namePlaceholder')}
          value={rename}
          onChange={e => setRename(e.target.value)}
        />
        <button className="btn btn-block" style={{ marginTop: 8 }} disabled={!rename.trim() || busy} onClick={() => void renameRoom()}>
          {busy ? t('common.saving') : t('groups.renameButton')}
        </button>
        <div className="sheet-divider" />
        {driverReady && (
          <button className="btn btn-block" disabled={busy} onClick={() => void stopRound()}>
            {t('groups.stopRound')}
          </button>
        )}
        {confirmingDisband ? (
          <div className="group-disband-confirm" role="alertdialog" aria-label={t('groups.deleteAria')}>
            <p className="muted">{t('groups.deleteConfirmBody')}</p>
            <div className="group-action-buttons">
              <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => void disbandRoom().then(() => back())}>
                {t('groups.yesDelete')}
              </button>
              <button className="btn btn-sm" onClick={() => setConfirmingDisband(false)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-block btn-danger" style={{ marginTop: 8 }} disabled={busy} onClick={() => setConfirmingDisband(true)}>
            {t('groups.delete')}
          </button>
        )}
      </Sheet>
    </div>
  )
}
