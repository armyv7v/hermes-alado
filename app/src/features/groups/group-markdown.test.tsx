import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GroupMarkdown } from './group-markdown'

describe('GroupMarkdown', () => {
  it('renders @mentions, paths and code without crashing (blank-screen regression)', () => {
    const html = renderToStaticMarkup(
      <GroupMarkdown text={'@lola armá el plan y @nico buscá en `/tmp/notas.md` o ~/docs/plan.txt'} />,
    )
    expect(html).toContain('<code>@lola</code>')
    expect(html).toContain('<code>@nico</code>')
    expect(html).toContain('<code>~/docs/plan.txt</code>')
  })
})
