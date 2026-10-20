import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '../../../tests/helpers/render'
import SourceLink, { SOURCE_URL, UPSTREAM_URL } from './SourceLink'

describe('SourceLink（AGPL-3.0 §13 原始碼連結）', () => {
  it('ENSCON-SRC-001: 顯示原始碼連結，指向我們的 fork，並註明基於 TREK', () => {
    render(<SourceLink />)
    const src = screen.getByRole('link', { name: '原始碼' })
    expect(src).toHaveAttribute('href', SOURCE_URL)
    expect(SOURCE_URL).toMatch(/^https:\/\/github\.com\/JoeyVIP\/enscon-trip$/)
    const up = screen.getByRole('link', { name: 'TREK' })
    expect(up).toHaveAttribute('href', UPSTREAM_URL)
    expect(screen.getByTestId('source-link').textContent).toContain('AGPL-3.0')
  })

  it('ENSCON-SRC-002: 外部連結用新分頁開、帶 noopener noreferrer', () => {
    render(<SourceLink />)
    for (const a of screen.getAllByRole('link')) {
      expect(a).toHaveAttribute('target', '_blank')
      expect(a.getAttribute('rel')).toContain('noopener')
    }
  })

  describe('手機版不浮在底部工具列上（改放「更多」選單）', () => {
    const origWidth = window.innerWidth
    const setWidth = (w: number) => { window.innerWidth = w }
    afterEach(() => setWidth(origWidth))

    it('ENSCON-SRC-003: 桌面版維持浮動連結', () => {
      setWidth(1280)
      render(<SourceLink />, { initialEntries: ['/dashboard'] })
      expect(screen.getByTestId('source-link')).toBeInTheDocument()
    })

    it('ENSCON-SRC-004: 登入後的手機版不浮出連結', () => {
      setWidth(390)
      render(<SourceLink />, { initialEntries: ['/dashboard'] })
      expect(screen.queryByTestId('source-link')).not.toBeInTheDocument()
    })

    it.each(['/login', '/register', '/shared/abc123'])('ENSCON-SRC-005: 手機版 %s 沒有工具列，維持浮動連結', (path) => {
      setWidth(390)
      render(<SourceLink />, { initialEntries: [path] })
      expect(screen.getByTestId('source-link')).toBeInTheDocument()
    })

    it('ENSCON-SRC-006: 手機版行程頁不浮出連結（會疊到行程頁導覽列，改放導覽列「更多」）', () => {
      setWidth(390)
      render(<SourceLink />, { initialEntries: ['/trips/7'] })
      expect(screen.queryByTestId('source-link')).not.toBeInTheDocument()
    })

    it('ENSCON-SRC-007: 桌面版行程頁維持浮動連結', () => {
      setWidth(1280)
      render(<SourceLink />, { initialEntries: ['/trips/7'] })
      expect(screen.getByTestId('source-link')).toBeInTheDocument()
    })
  })
})
