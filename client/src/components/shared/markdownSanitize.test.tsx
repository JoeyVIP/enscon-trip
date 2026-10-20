import { describe, expect, it } from 'vitest'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { render } from '../../../tests/helpers/render'
import { sanitizedMarkdownComponents, sanitizedMarkdownPlugins } from './markdownSanitize'

// FE-MDSAN-001 to FE-MDSAN-003 (Taiwan fork)

const TABLE = [
  '## 刷卡順序',
  '',
  '| 卡片 | 目前回饋 | 期限 |',
  '|---|---|---|',
  '| 台新 GoGo | 3.3% | 2027/3/31 |',
  '| 中信 uniopen | 海外實體店 3% | 2026/12/31 |',
].join('\n')

function renderMd(md: string) {
  return render(
    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={sanitizedMarkdownPlugins} components={sanitizedMarkdownComponents}>
      {md}
    </Markdown>,
  )
}

describe('sanitizedMarkdownComponents', () => {
  it('FE-MDSAN-001: a GFM table renders inside its own horizontal scroller', () => {
    const { container } = renderMd(TABLE)
    const table = container.querySelector('table')
    expect(table).not.toBeNull()
    const scroller = table!.parentElement!
    expect(scroller).toHaveAttribute('data-md-table-scroll')
    expect(scroller.className).toContain('overflow-x-auto')
    expect(scroller.className).toContain('max-w-full')
    expect(container.querySelectorAll('th')).toHaveLength(3)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('FE-MDSAN-002: the table wrapper does not leak the hast node onto the DOM', () => {
    const { container } = renderMd(TABLE)
    expect(container.querySelector('table')!.getAttribute('node')).toBeNull()
  })

  it('FE-MDSAN-003: headings and external links keep their behaviour', () => {
    const { container } = renderMd('## 小標\n\n[官網](https://example.test)')
    expect(container.querySelector('h2')).toHaveTextContent('小標')
    const a = container.querySelector('a')!
    expect(a).toHaveAttribute('target', '_blank')
    expect(a.getAttribute('rel')).toContain('noopener')
  })
})
