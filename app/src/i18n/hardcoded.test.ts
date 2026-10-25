/**
 * Guard rail: no hardcoded user-facing strings.
 *
 * Scans `src/**` .tsx files (excluding `*.test.*` and the dev-only
 * `ui/UiPage.tsx` gallery) and fails on:
 *  - JSX text nodes containing letters (they must be `{t('key')}`)
 *  - string-literal `placeholder` / `aria-label` / `title` / `label` props
 *    containing letters (they must be `{t('key')}` or a dynamic expression)
 *
 * A small explicit allowlist covers brand words and unit symbols. Adding a
 * new literal user string must fail here — add an i18n key instead.
 *
 * Files are loaded as raw strings via `import.meta.glob` (Vite): no node
 * runtime APIs, so it typechecks under the app's browser-only tsconfig.
 */
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const RAW_TSX = import.meta.glob(
  ['../**/*.tsx', '!../**/*.test.tsx', '!../ui/UiPage.tsx'],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>

const SCANNED_PROPS = new Set(['placeholder', 'aria-label', 'title', 'label'])

/** Brand words and unit symbols that may appear as literals. */
const ALLOWLIST = new Set([
  'HERMES AGENT',
  'CONNECT',
  'Hermes',
  'Auto',
  's',
  'min',
  'h',
  'v',
])

interface Violation {
  file: string
  line: number
  text: string
}

function hasLetters(text: string): boolean {
  return /[a-záéíóúñ]/i.test(text)
}

function scanFile(displayPath: string, content: string): Violation[] {
  const source = ts.createSourceFile(
    displayPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const violations: Violation[] = []

  const checkLiteral = (node: ts.Node, raw: string) => {
    const text = raw.trim()
    if (!hasLetters(text)) return
    if (ALLOWLIST.has(text)) return
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
    violations.push({ file: displayPath, line: line + 1, text: JSON.stringify(text) })
  }

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      checkLiteral(node, node.text)
    }
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && SCANNED_PROPS.has(node.name.text)) {
      const init = node.initializer
      if (init && ts.isStringLiteral(init)) {
        checkLiteral(init, init.text)
      } else if (init && ts.isJsxExpression(init) && init.expression && ts.isStringLiteral(init.expression)) {
        checkLiteral(init.expression, init.expression.text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return violations
}

describe('no hardcoded user-facing strings', () => {
  it('every literal JSX text and string-literal prop is wrapped in t()', () => {
    const violations: Violation[] = []
    for (const [path, content] of Object.entries(RAW_TSX)) {
      violations.push(...scanFile(path, content))
    }
    expect(
      violations,
      violations.length === 0
        ? ''
        : `hardcoded strings found:\n${violations.map(v => `  ${v.file}:${v.line} → ${v.text}`).join('\n')}`,
    ).toHaveLength(0)
  })
})
