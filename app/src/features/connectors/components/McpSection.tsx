import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../../../i18n'
import {
  deleteMcpServer,
  installMcpEntry,
  mcpInstallFields,
  setMcpServerEnabled,
  testMcpServer,
  type McpCatalogEntry,
  type McpServerSummary,
} from '../../../lib/hermes/connectors'
import { Sheet } from '../../../ui/Sheet'
import { Toggle } from '../../../ui/Toggle'
import { ConfigForm } from './ConfigForm'
import { OAuthButton } from './OAuthButton'

export function McpSection({
  name,
  profile,
  entry,
  server,
  onChanged,
}: {
  name: string
  profile?: string
  entry: McpCatalogEntry | undefined
  server: McpServerSummary | undefined
  onChanged: () => Promise<void> | void
}) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string; tools: { name: string; description: string }[] } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const t = useT()

  if (!server) {
    if (!entry) return <p className="muted">{t('connectors.mcp.notInCatalog')}</p>
    const installFields = mcpInstallFields(entry)
    const run = async ({ values }: { values: Record<string, string>; clears: string[] }) => {
      setBusy('install')
      setError('')
      try {
        const res = await installMcpEntry(entry.name, values, profile)
        if (res.background) setError(t('connectors.mcp.installingBg'))
        else setError(t('connectors.mcp.installed'))
        await onChanged()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('connectors.mcp.installFailed'))
      } finally {
        setBusy('')
      }
    }
    return (
      <>
        {installFields.length > 0 && (
          <div className="ui-section">
            <h2>{t('connectors.mcp.config')}</h2>
            <ConfigForm
              key={entry.name}
              fields={installFields}
              busy={busy === 'install'}
              submitLabel={t('connectors.mcp.installConnect')}
              onSubmit={run}
            />
          </div>
        )}
        {installFields.length === 0 && (
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={busy === 'install'}
            onClick={() =>
              void (async () => {
                setBusy('install')
                setError('')
                try {
                  await installMcpEntry(entry.name, {}, profile)
                  await onChanged()
                } catch (e) {
                  setError(e instanceof Error ? e.message : t('connectors.mcp.installFailed'))
                } finally {
                  setBusy('')
                }
              })()
            }
          >
            {busy === 'install' ? '…' : t('connectors.mcp.installConnect')}
          </button>
        )}
        {error && <p className="error-text">{error}</p>}
      </>
    )
  }

  const oauth = entry?.auth_type === 'oauth' || server.auth === 'oauth'

  const test = async () => {
    setBusy('test')
    setTestResult(null)
    try {
      setTestResult(await testMcpServer(name, profile))
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : t('connectors.mcp.testFailed'), tools: [] })
    } finally {
      setBusy('')
    }
  }

  const toggle = async (enabled: boolean) => {
    setBusy('toggle')
    try {
      await setMcpServerEnabled(name, enabled, profile)
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.mcp.saveFailed'))
    } finally {
      setBusy('')
    }
  }

  const remove = async () => {
    setConfirmDelete(false)
    setBusy('delete')
    try {
      await deleteMcpServer(name, profile)
      navigate(`/bots/${encodeURIComponent(profile ?? 'default')}/connectors`)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('connectors.mcp.disconnectFailed'))
      setBusy('')
    }
  }

  return (
    <>
      <div className="ui-section">
        <h2>{t('connectors.mcp.status')}</h2>
        <div className="list">
          <div className="list-row">
            <span className="list-row-body">
              <span className="list-row-title">{t('connectors.mcp.enabled')}</span>
              <span className="list-row-subtitle">{server.transport === 'stdio' ? 'stdio' : server.url ?? ''}</span>
            </span>
            <span className="list-row-trailing">
              <Toggle checked={server.enabled} onChange={v => void toggle(v)} label={t('connectors.mcp.enabled')} />
            </span>
          </div>
          {Object.keys(server.env).length > 0 && (
            <div className="list-row">
              <span className="list-row-body">
                <span className="list-row-title">{t('connectors.mcp.envVars')}</span>
                <span className="list-row-subtitle">{Object.keys(server.env).join(', ')}</span>
              </span>
              <span className="list-row-trailing">{t('connectors.mcp.configuredLower')}</span>
            </div>
          )}
        </div>
      </div>

      <div className="ui-section">
        <h2>{t('connectors.mcp.test')}</h2>
        <button type="button" className="btn btn-block" disabled={busy === 'test'} onClick={() => void test()}>
          {busy === 'test' ? t('connectors.mcp.testing') : t('connectors.mcp.testConnection')}
        </button>
        {testResult && (
          <div className="card" style={{ marginTop: 10 }}>
            {testResult.ok ? (
              <p className="chip ok">{t('connectors.mcp.connectionOk', { count: testResult.tools.length })}</p>
            ) : (
              <p className="error-text">{testResult.error ?? t('connectors.mcp.connectionFailed')}</p>
            )}
            {testResult.tools.length > 0 && (
              <ul className="tool-list">
                {testResult.tools.map(t => (
                  <li key={t.name}>
                    <strong>{t.name}</strong> — {t.description}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {oauth && (
        <div className="ui-section">
          <h2>{t('connectors.mcp.oauth')}</h2>
          <OAuthButton serverName={name} profile={profile} onDone={() => void onChanged()} />
        </div>
      )}

      <div className="ui-section">
        <h2>{t('connectors.mcp.disconnect')}</h2>
        <button
          type="button"
          className="btn btn-block"
          style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
          disabled={busy === 'delete'}
          onClick={() => setConfirmDelete(true)}
        >
          {busy === 'delete' ? '…' : t('connectors.mcp.disconnect')}
        </button>
        <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t('connectors.mcp.disconnectTitle')}>
          <p className="muted">{t('connectors.mcp.disconnectBody', { name })}</p>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-danger" onClick={() => void remove()}>
              {t('connectors.mcp.disconnect')}
            </button>
          </div>
        </Sheet>
      </div>
      {error && <p className="error-text">{error}</p>}
    </>
  )
}
