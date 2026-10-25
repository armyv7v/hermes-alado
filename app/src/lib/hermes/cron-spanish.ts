// Cron expressions → human text, localized via i18n (English/Spanish). Pure,
// deterministic, unit-tested.
//
// `tz` is accepted for API compatibility: jobs live per-profile and a profile
// carries its own timezone, but the produced text never depends on it because
// cron expressions carry no zone. DST-aware "next run" math belongs to the
// backend (`next_run_at`), not to this formatter.

import { localeTag, t } from '../../i18n'

const DOW_MAP: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
}

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
}

const MIN_MIN = 0
const MIN_MAX = 59
const HOUR_MIN = 0
const HOUR_MAX = 23
const DOM_MIN = 1
const DOM_MAX = 31
const MONTH_MIN = 1
const MONTH_MAX = 12
const DOW_MIN = 0
const DOW_MAX = 7

interface CronInterval {
  from: number
  to: number
  step?: number
  all?: boolean
}

function parseValue(token: string, names?: Record<string, number>): number | null {
  const t = token.toLowerCase()
  if (/^\d+$/.test(t)) return Number(t)
  if (names && names[t] !== undefined) return names[t]
  return null
}

/**
 * Parse one cron field into intervals. `null` when the field is not
 * something we understand — the caller then falls back to the raw expression.
 */
function parseField(
  field: string,
  min: number,
  max: number,
  names?: Record<string, number>,
): CronInterval[] | null {
  const tokens = field.split(',').map(t => t.trim())
  const intervals: CronInterval[] = []
  for (const token of tokens) {
    if (!token) return null
    if (token === '*') {
      intervals.push({ from: min, to: max, all: true })
      continue
    }
    let body = token
    let step: number | undefined
    const slash = token.indexOf('/')
    if (slash !== -1) {
      body = token.slice(0, slash)
      const stepText = token.slice(slash + 1)
      if (!/^\d+$/.test(stepText) || Number(stepText) <= 0) return null
      step = Number(stepText)
    }
    if (body === '*') {
      intervals.push({ from: min, to: max, step, all: true })
      continue
    }
    const dash = body.indexOf('-')
    if (dash !== -1) {
      const from = parseValue(body.slice(0, dash), names)
      const to = parseValue(body.slice(dash + 1), names)
      if (from === null || to === null) return null
      if (from < min || to > max || from > to) return null
      intervals.push({ from, to, step })
      continue
    }
    const value = parseValue(body, names)
    if (value === null || value < min || value > max) return null
    // "0/15" means "from 0, every 15" — same lattice as star-slash-15.
    intervals.push(step !== undefined ? { from: value, to: max, step } : { from: value, to: value })
  }
  return intervals
}

function isAll(f: CronInterval[]): boolean {
  return f.length === 1 && f[0].all === true && f[0].step === undefined
}

/** Step when the field spans its whole lattice ("star-slash-N" or "0/N"). */
function wholeStep(f: CronInterval[], min: number, max: number): number | undefined {
  if (f.length !== 1 || f[0].step === undefined) return undefined
  const iv = f[0]
  return iv.from === min && iv.to === max ? iv.step : undefined
}

function single(f: CronInterval[]): number | null {
  if (f.length !== 1 || f[0].from !== f[0].to || f[0].step !== undefined) return null
  return f[0].from
}

function expandDow(dow: CronInterval[]): number[] | null {
  const days: number[] = []
  for (const iv of dow) {
    if (iv.all) return null
    for (let d = iv.from; d <= iv.to; d += iv.step ?? 1) {
      days.push(d === 7 ? 0 : d)
    }
  }
  const unique = [...new Set(days)]
  return unique
}

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function formatTime(hour: number, minute: number): string {
  return `${hour}:${String(minute).padStart(2, '0')}`
}

function weekdayName(day: number): string {
  // Local midnight on a fixed Sunday (2024-01-07), formatted in UTC so the
  // host timezone can never shift the day back.
  const date = new Date(2024, 0, 7 + day)
  const name = new Intl.DateTimeFormat(localeTag(), { weekday: 'long', timeZone: 'UTC' }).format(date)
  return name
}

function joinDays(days: number[]): string {
  if (days.length === 0) return ''
  const names = days.map(d => weekdayName(d))
  if (days.length === 1) return cap(names[0])
  const head = cap(names[0])
  if (days.length === 2) return t('cron.andJoin', { a: head, b: names[1] })
  return t('cron.listJoin', { head, rest: names.slice(1, -1).join(', '), last: names[names.length - 1] })
}

function contiguous(days: number[]): boolean {
  for (let i = 1; i < days.length; i++) {
    if (days[i] !== days[i - 1] + 1) return false
  }
  return true
}

function dowText(dow: CronInterval[], time: string): string {
  const days = expandDow(dow)
  if (days === null) return t('cron.everyDayAt', { time })
  if (days.length === 0) return t('cron.everyDayAt', { time })
  days.sort((a, b) => a - b)
  if (days.length === 1) return t('cron.everyWeekday', { weekday: weekdayName(days[0]), time })
  if (contiguous(days)) return t('cron.weekdayRange', { from: weekdayName(days[0]), to: weekdayName(days[days.length - 1]), time })
  return t('cron.daysAt', { days: joinDays(days), time })
}

/**
 * 5-field (or 6-field, seconds first) cron expression → localized text, e.g.
 * `0 7 * * 1-5` → "Weekdays at 7:00" (es: "De lunes a viernes a las 7:00").
 * Anything not recognized falls back to the raw expression.
 */
export function cronToSpanish(expr: string, tz?: string): string {
  void tz
  const text = (expr ?? '').trim()
  if (!text) return ''

  const parts = text.split(/\s+/)
  const fields = parts.length === 6 ? parts.slice(1) : parts
  if (fields.length !== 5) return text

  const minute = parseField(fields[0], MIN_MIN, MIN_MAX)
  const hour = parseField(fields[1], HOUR_MIN, HOUR_MAX)
  const dom = parseField(fields[2], DOM_MIN, DOM_MAX)
  const month = parseField(fields[3], MONTH_MIN, MONTH_MAX, MONTH_MAP)
  const dow = parseField(fields[4], DOW_MIN, DOW_MAX, DOW_MAP)
  if (!minute || !hour || !dom || !month || !dow) return text

  const everyMinute = wholeStep(minute, MIN_MIN, MIN_MAX)
  if (everyMinute !== undefined && isAll(hour) && isAll(dom) && isAll(month) && isAll(dow)) {
    return everyMinute === 1 ? t('cron.everyMinute') : t('cron.everyNMinutes', { n: everyMinute })
  }
  if (isAll(minute) && isAll(hour) && isAll(dom) && isAll(month) && isAll(dow)) {
    return t('cron.everyMinute')
  }

  const everyHour = wholeStep(hour, HOUR_MIN, HOUR_MAX)
  if (
    everyHour !== undefined &&
    (isAll(minute) || single(minute) === 0) &&
    isAll(dom) && isAll(month) && isAll(dow)
  ) {
    return everyHour === 1 ? t('cron.everyHour') : t('cron.everyNHours', { n: everyHour })
  }
  if (single(minute) === 0 && isAll(hour) && isAll(dom) && isAll(month) && isAll(dow)) {
    return t('cron.everyHour')
  }

  const minuteValue = single(minute)
  const hourValue = single(hour)
  if (minuteValue === null || hourValue === null) return text
  const time = formatTime(hourValue, minuteValue)

  if (isAll(dom) && isAll(month)) {
    return dowText(dow, time)
  }

  const domValue = single(dom)
  if (domValue !== null && isAll(month) && isAll(dow)) {
    return t('cron.dayOfMonth', { day: domValue, time })
  }

  return text
}

export type CronSchedule =
  | string
  | {
      kind?: string
      expr?: string
      minutes?: number
      run_at?: string
      display?: string
      [key: string]: unknown
    }
  | null
  | undefined

function intervalMinutes(display?: string): number | null {
  if (!display) return null
  const match = /every\s+(\d+)\s*m/i.exec(display.trim())
  if (!match) return null
  return Number(match[1])
}

function formatRunAt(runAt?: string): string {
  if (!runAt) return ''
  const date = new Date(runAt)
  if (Number.isNaN(date.getTime())) return ''
  const dateText = new Intl.DateTimeFormat(localeTag(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
  const timeText = new Intl.DateTimeFormat(localeTag(), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).format(date)
  return t('cron.dateTime', { date: dateText, time: timeText })
}

/**
 * Human, localized schedule for any shape the backend may return
 * (`cron/jobs.py` `parse_schedule`: kind "cron" | "interval" | "once").
 * Handles the legacy string shape too. Empty string → caller falls back to
 * `schedule_display`.
 */
export function scheduleToSpanish(schedule: CronSchedule, tz?: string): string {
  if (!schedule) return ''
  if (typeof schedule === 'string') {
    const text = schedule.trim()
    return text ? cronToSpanish(text, tz) : ''
  }

  const kind = schedule.kind
  if (kind === 'interval') {
    const minutes = typeof schedule.minutes === 'number' && schedule.minutes > 0
      ? schedule.minutes
      : intervalMinutes(schedule.display)
    if (minutes !== null && minutes > 0) {
      if (minutes % 60 === 0) {
        const hours = minutes / 60
        return hours === 1 ? t('cron.everyHour') : t('cron.everyNHours', { n: hours })
      }
      return minutes === 1 ? t('cron.everyMinute') : t('cron.everyNMinutes', { n: minutes })
    }
    return schedule.display ?? ''
  }

  if (kind === 'once') {
    const when = formatRunAt(schedule.run_at)
    return when ? t('cron.once', { when }) : t('cron.onceOnly')
  }

  if (schedule.expr) return cronToSpanish(schedule.expr, tz)
  if (schedule.display) return schedule.display
  return schedule.run_at ? t('cron.once', { when: formatRunAt(schedule.run_at) }) : ''
}
