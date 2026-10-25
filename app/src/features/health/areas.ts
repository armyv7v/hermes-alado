import { t, type TextKey } from '../../i18n'
import { normalizeSectionTitle, type DoctorCheck, type DoctorResult } from '../../lib/hermes/doctor-output'

/** Product-facing area label keys for the doctor's own section titles. */
const SECTION_AREA: Record<string, 'health.areas.modelCreds' | 'health.areas.tools' | 'health.areas.security' | 'health.areas.data'> = {
  'Auth Providers': 'health.areas.modelCreds',
  'API Connectivity': 'health.areas.modelCreds',
  'Configuration Files': 'health.areas.modelCreds',
  'Python Environment': 'health.areas.tools',
  'Required Packages': 'health.areas.tools',
  'External Tools': 'health.areas.tools',
  'Tool Availability': 'health.areas.tools',
  'Skills Hub': 'health.areas.tools',
  'MCP Server Security': 'health.areas.security',
  'Security Advisories': 'health.areas.security',
  'SSL / CA Certificates': 'health.areas.security',
  'NeMo Relay Plugins': 'health.areas.security',
  'Directory Structure': 'health.areas.data',
  'Memory Provider': 'health.areas.data',
  'Session Reset': 'health.areas.data',
  'xAI Model Retirement': 'health.areas.data',
}

const AREA_ORDER: ('health.areas.modelCreds' | 'health.areas.tools' | 'health.areas.browser' | 'health.areas.computer' | 'health.areas.security' | 'health.areas.data')[] = [
  'health.areas.modelCreds',
  'health.areas.tools',
  'health.areas.browser',
  'health.areas.computer',
  'health.areas.security',
  'health.areas.data',
]

const BROWSER_RE = /chromium|agent-browser|lightpanda|browser|playwright/i
const COMPUTER_RE = /display|x11|wayland|computer use|computer_use|screen/i

function areaKeyFor(check: DoctorCheck, sectionTitle: string): string {
  if (BROWSER_RE.test(check.text)) return 'health.areas.browser'
  if (COMPUTER_RE.test(check.text)) return 'health.areas.computer'
  return SECTION_AREA[normalizeSectionTitle(sectionTitle)] ?? 'health.areas.tools'
}

export interface AreaGroup {
  labelKey: string
  label: string
  checks: DoctorCheck[]
}

/**
 * Fold the doctor's raw sections into the product's areas (the brief's
 * "Model/credentials, Tools, Browser, Computer…"). Browser and computer
 * checks are pulled out of their hosting section by keyword.
 */
export function groupDoctorAreas(result: DoctorResult): AreaGroup[] {
  const byKey = new Map<string, DoctorCheck[]>()
  for (const section of result.sections) {
    for (const check of section.checks) {
      const key = areaKeyFor(check, section.title)
      const list = byKey.get(key) ?? []
      list.push(check)
      byKey.set(key, list)
    }
  }
  const order = [...AREA_ORDER, ...[...byKey.keys()].filter(k => !AREA_ORDER.includes(k as never))]
  return order
    .filter(key => byKey.has(key))
    .map(key => ({ labelKey: key, label: t(key as TextKey), checks: byKey.get(key) ?? [] }))
}
