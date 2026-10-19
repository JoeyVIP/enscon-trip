import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
