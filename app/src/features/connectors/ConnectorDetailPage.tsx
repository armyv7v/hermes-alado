import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '@nanostores/react'
import { useT, type TextKey } from '../../i18n'
import {
  isConnectorFamily,
  isHubId,
  type Connector,
} from '../../lib/hermes/connectors'
import { BotScopedScreen } from '../bot-profile/BotScopedScreen'
import { BrandIcon } from '../../ui/BrandIcon'
import { StatusDot, type DotTone } from '../../ui/StatusDot'
import { Skeleton } from '../../ui/Skeleton'
import { McpSection } from './components/McpSection'
import { MessagingSection } from './components/MessagingSection'
import { PluginSection } from './components/PluginSection'
import { SkillSection } from './components/SkillSection'
import { ToolsetSection } from './components/ToolsetSection'
import { familyData, loadFamilyData, findConnector } from './store'
import './connectors.css'

const STATUS_LABEL_KEYS: Record<Connector['status'], TextKey> = {
  connected: 'connectors.status.connected',
  available: 'connectors.status.available',
  needs_setup: 'connectors.status.needsSetup',
  error: 'connectors.status.error',
}

const STATUS_TONE: Record<Connector['status'], DotTone> = {
  connected: 'ok',
  available: 'neutral',
  needs_setup: 'warn',
  error: 'danger',
}

const FAMILY_LABEL_KEYS: Record<string, TextKey> = {
  apps: 'connectors.family.apps',
  tools: 'connectors.family.tools',
  skills: 'connectors.family.skills',
  plugins: 'connectors.family.plugins',
  messaging: 'connectors.family.messaging',
}

export function ConnectorDetailPage() {
  const { profile = 'default', family, id } = useParams()
  const data = useStore(familyData)
  const t = useT()

  const connector = isConnectorFamily(family) ? findConnector(family, id) : undefined

  useEffect(() => {
    if (!id) return
    if (!isConnectorFamily(family)) return
    if (!connector) void loadFamilyData(family, profile)
  }, [family, id, connector, profile])

  const refresh = async () => {
    if (!isConnectorFamily(family)) return
    await loadFamilyData(family, profile)
  }

  const notFound = (body: 'skeleton' | 'missing') => (
    <BotScopedScreen profile={profile} title={t('connectors.connector')}>
      {body === 'skeleton' ? (
        <div className="list">
          <Skeleton />
          <Skeleton width={200} />
          <Skeleton width={160} />
        </div>
      ) : (
        <p className="muted">{t('connectors.notFound')}</p>
      )}
    </BotScopedScreen>
  )

  if (!isConnectorFamily(family) || !id) {
    return notFound('missing')
  }

  if (!connector) {
    return notFound(data[family] === undefined ? 'skeleton' : 'missing')
  }

  const messagingPlatform =
    connector.family === 'messaging' && data.messaging
      ? data.messaging.payload.platforms.find(p => p.id === connector.id)
      : undefined

  return (
    <BotScopedScreen
      profile={profile}
      title={connector.name}
      actions={<StatusDot tone={STATUS_TONE[connector.status]} label={t(STATUS_LABEL_KEYS[connector.status])} />}
    >
      <div className="detail-head">
        <BrandIcon name={connector.name} size={56} />
        <div className="detail-head-meta">
          <span className="detail-family">{t(FAMILY_LABEL_KEYS[connector.family])}</span>
        </div>
      </div>

      {connector.description && <p className="detail-description">{connector.description}</p>}

      {connector.family === 'apps' && (
        <McpSection
          name={connector.name}
          profile={profile}
          entry={data.apps?.catalog.find(e => e.name === connector.name)}
          server={data.apps?.servers.find(s => s.name === connector.name)}
          onChanged={refresh}
        />
      )}

      {connector.family === 'tools' && (
        <ToolsetSection
          name={connector.id}
          profile={profile}
          enabled={data.tools?.toolsets.find(t => t.name === connector.id)?.enabled ?? false}
          onChanged={refresh}
        />
      )}

      {connector.family === 'skills' && (
        <SkillSection
          id={connector.id}
          name={connector.name}
          profile={profile}
          enabled={connector.status === 'connected'}
          hubProvenance={
            !isHubId(connector.id) &&
            data.skills?.skills.find(s => s.name === connector.name)?.provenance === 'hub'
          }
          onChanged={refresh}
        />
      )}

      {connector.family === 'plugins' && (
        <PluginSection
          name={connector.id}
          profile={profile}
          row={data.plugins?.hub.plugins.find(p => p.name === connector.id)}
          onChanged={refresh}
        />
      )}

      {connector.family === 'messaging' && messagingPlatform && (
        <MessagingSection platform={messagingPlatform} profile={profile} onChanged={refresh} />
      )}

      {connector.family === 'messaging' && !messagingPlatform && <p className="muted">{t('connectors.noChannelData')}</p>}
    </BotScopedScreen>
  )
}
