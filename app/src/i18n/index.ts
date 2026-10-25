/**
 * Tiny typed i18n for Alado — no library. `en.ts` is the source of truth and
 * `es.ts` mirrors it exactly (`satisfies Messages`), so a missing key fails
 * `tsc` and a key-parity test guards runtime drift.
 *
 * - `localeChoice` ('system' | 'en' | 'es') persists in `alado.locale`
 *   (a non-secret preference, same family as the theme).
 * - `locale` resolves 'system' from `navigator.languages` (first `es*` match).
 * - `t(key, vars)` interpolates `{name}`; `tp(key, count, vars)` resolves
 *   `{ one, other }` plurals via Intl.PluralRules.
 * - `useT()` re-renders React components on locale change.
 * - `formatTime/formatDate/formatRelative/formatMinutesAgo` wrap Intl with the
 *   active locale.
 */
import { atom, computed } from 'nanostores'
import { useStore } from '@nanostores/react'
import { en, type Plural } from './en'
import { es } from './es'

export type Locale = 'en' | 'es'
export type LocaleChoice = 'system' | Locale

export const LOCALE_KEY = 'alado.locale'

const MESSAGES = { en, es } as const

type Leaf = string | Plural

type DotKeys<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends Leaf
    ? `${Prefix}${K}`
    : T[K] extends object
      ? DotKeys<T[K], `${Prefix}${K}.`>
      : never
}[keyof T & string]

type TextKeys<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends Plural
      ? never
      : T[K] extends object
        ? DotKeys<T[K], `${K}.`>
        : never
}[keyof T & string]

type PluralKeys<T> = {
  [K in keyof T & string]: T[K] extends Plural
    ? K
    : T[K] extends object
      ? DotKeys<T[K], `${K}.`>
      : never
}[keyof T & string]

export type TextKey = TextKeys<typeof en>
export type PluralKey = PluralKeys<typeof en>
export type InterpolationVars = Record<string, string | number>

function readChoice(): LocaleChoice {
  try {
    if (typeof localStorage === 'undefined') return 'system'
    const v = localStorage.getItem(LOCALE_KEY)
    return v === 'en' || v === 'es' ? v : 'system'
  } catch {
    return 'system'
  }
}

function detectSystemLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  const langs = navigator.languages ?? [navigator.language]
  for (const lang of langs) {
    if (/^es\b/i.test(lang)) return 'es'
  }
  return 'en'
}

export const localeChoice = atom<LocaleChoice>(readChoice())

export const locale = computed(localeChoice, choice =>
  choice === 'en' || choice === 'es' ? choice : detectSystemLocale(),
)

/** The Intl tag for the active locale ('es-AR' / 'en-US'). */
export function localeTag(l: Locale = locale.get()): string {
  return l === 'es' ? 'es-AR' : 'en-US'
}

export function setLocaleChoice(choice: LocaleChoice): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LOCALE_KEY, choice)
  } catch {
    // storage unavailable; the in-memory choice still applies for this session
  }
  localeChoice.set(choice)
}

function applyHtmlLang(): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale.get()
}

/** Boot the locale once (main.tsx) and keep `<html lang>` in sync. */
export function initLocale(): void {
  applyHtmlLang()
  localeChoice.subscribe(applyHtmlLang)
}

function interpolate(text: string, vars?: InterpolationVars): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''))
}

function valueAt(messages: unknown, key: string): unknown {
  let node: unknown = messages
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || isPlural(node)) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return node
}

function isPlural(value: unknown): value is Plural {
  return typeof value === 'object' && value !== null && 'one' in value && 'other' in value
}

/** Translate a plain string key with `{name}` interpolation. */
export function t(key: TextKey, vars?: InterpolationVars): string {
  const value = valueAt(MESSAGES[locale.get()], key)
  return typeof value === 'string' ? interpolate(value, vars) : key
}

/** Translate a `{ one, other }` plural key, picking the form via Intl. */
export function tp(key: PluralKey, count: number, vars?: InterpolationVars): string {
  const value = valueAt(MESSAGES[locale.get()], key)
  if (!isPlural(value)) return key
  const rule = new Intl.PluralRules(localeTag()).select(count)
  const picked = rule === 'one' ? value.one : value.other
  return interpolate(picked, { ...vars, count })
}

/** React hook: re-renders on locale change and returns a live `t`. */
export function useT(): (key: TextKey, vars?: InterpolationVars) => string {
  useStore(locale)
  return t
}

/** React hook for plural keys, re-rendering on locale change. */
export function useTp(): (key: PluralKey, count: number, vars?: InterpolationVars) => string {
  useStore(locale)
  return tp
}

// ── formatting helpers (Intl, locale-aware) ─────────────────────────────────

const WEEKDAY_FORMAT = new Map<Locale, Intl.DateTimeFormat>()

function weekdayName(l: Locale, date: Date): string {
  let fmt = WEEKDAY_FORMAT.get(l)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(localeTag(l), { weekday: 'long' })
    WEEKDAY_FORMAT.set(l, fmt)
  }
  const name = fmt.format(date)
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** HH:mm in the active locale. */
export function formatTime(value: Date | number, l: Locale = locale.get()): string {
  return new Intl.DateTimeFormat(localeTag(l), { hour: '2-digit', minute: '2-digit' }).format(value)
}

/** Short date in the active locale (e.g. "15 abr 2026"). */
export function formatDate(value: Date | number, l: Locale = locale.get()): string {
  return new Intl.DateTimeFormat(localeTag(l), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(value)
}

/** Date + time in the active locale. */
export function formatDateTime(value: Date | number, l: Locale = locale.get()): string {
  return new Intl.DateTimeFormat(localeTag(l), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

/**
 * Home-list relative stamp (seconds since epoch): time today, "Yesterday",
 * weekday within the week, `dd/mm` beyond.
 */
export function formatRelative(ts: number, nowMs = Date.now(), l: Locale = locale.get()): string {
  const date = new Date(ts * 1000)
  const now = new Date(nowMs)
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const diffDays = Math.floor((startToday - startOfDay) / 86400000)
  if (diffDays === 0) return formatTime(date, l)
  if (diffDays === 1) return t('home.yesterday')
  if (diffDays < 7) return weekdayName(l, date)
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** "hace 5 min" / "5 min ago" via Intl.RelativeTimeFormat. */
export function formatMinutesAgo(minutes: number, l: Locale = locale.get()): string {
  return new Intl.RelativeTimeFormat(localeTag(l), { numeric: 'auto' }).format(-minutes, 'minute')
}
