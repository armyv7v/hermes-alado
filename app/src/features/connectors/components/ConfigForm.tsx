import { useState } from 'react'
import { useT } from '../../../i18n'
import type { ConfigField } from '../../../lib/hermes/connectors'

export type ConfigSubmit = { values: Record<string, string>; clears: string[] }

/**
 * Dynamic config form built from backend schemas. Secret fields are password
 * inputs that never echo a stored value: when `isSet` the input is a blank
 * replacement (empty = keep), plus an optional per-key clear.
 */
export function ConfigForm({
  fields,
  busy,
  submitLabel,
  onSubmit,
}: {
  fields: ConfigField[]
  busy?: boolean
  submitLabel: string
  onSubmit: (submit: ConfigSubmit) => Promise<void> | void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {}
    for (const f of fields) if (f.kind !== 'secret') seed[f.key] = f.value
    return seed
  })
  const [clears, setClears] = useState<string[]>([])
  const t = useT()

  if (fields.length === 0) return null

  const clearKey = (key: string) =>
    setClears(cur => (cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key]))

  const submit = () => {
    const nonBlank: Record<string, string> = {}
    for (const [key, value] of Object.entries(values)) {
      if (value !== '') nonBlank[key] = value
    }
    void onSubmit({ values: nonBlank, clears })
  }

  return (
    <div className="config-form">
      {fields.map(f => (
        <div key={f.key} className="config-field">
          <label className="config-label" htmlFor={`cf-${f.key}`}>
            {f.label}
            {f.required && <span className="config-required"> *</span>}
          </label>
          {f.kind === 'secret' && f.isSet && f.redacted && (
            <span className="faint config-redacted">{f.redacted}</span>
          )}
          {f.kind !== 'secret' && (
            <input
              id={`cf-${f.key}`}
              className="input"
              value={values[f.key] ?? ''}
              onChange={e => setValues(cur => ({ ...cur, [f.key]: e.target.value }))}
            />
          )}
          {f.kind === 'secret' && (
            <div className="row" style={{ gap: 6 }}>
              <input
                id={`cf-${f.key}`}
                className="input"
                type="password"
                autoComplete="new-password"
                placeholder={f.isSet ? t('connectors.configForm.configuredReplace') : f.required ? t('connectors.configForm.required') : ''}
                value={values[f.key] ?? ''}
                onChange={e => setValues(cur => ({ ...cur, [f.key]: e.target.value }))}
              />
              {f.isSet && (
                <button
                  type="button"
                  className={`btn${clears.includes(f.key) ? ' btn-danger' : ''}`}
                  onClick={() => clearKey(f.key)}
                >
                  {clears.includes(f.key) ? t('connectors.configForm.keep') : t('connectors.configForm.clear')}
                </button>
              )}
            </div>
          )}
          {f.help && <span className="faint">{f.help}</span>}
          {f.url && (
            <a href={f.url} target="_blank" rel="noreferrer">
              {f.url}
            </a>
          )}
        </div>
      ))}
      <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={submit}>
        {busy ? '…' : submitLabel}
      </button>
    </div>
  )
}
