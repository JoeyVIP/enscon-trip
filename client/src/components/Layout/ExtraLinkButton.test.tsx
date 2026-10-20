import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '../../../tests/helpers/render'

const getAppConfig = vi.fn()
vi.mock('../../api/client', () => ({ authApi: { getAppConfig: () => getAppConfig() } }))

import ExtraLinkButton, { __resetExtraLinkCache } from './ExtraLinkButton'

// ENSCON：右下角額外連結（EXTRA_LINK_URL / EXTRA_LINK_LABEL）
afterEach(() => {
  vi.clearAllMocks()
  __resetExtraLinkCache()
})

describe('ExtraLinkButton', () => {
  it('FE-EXTRALINK-001: shows the link on a trip page, opening in a new tab', async () => {
    getAppConfig.mockResolvedValue({ extra_link: { url: 'https://arcade.example/', label: '🎮 小遊戲' } })
    render(<ExtraLinkButton />, { initialEntries: ['/trips/1'] })
    const a = await screen.findByTestId('extra-link-button')
    expect(a).toHaveAttribute('href', 'https://arcade.example/')
    expect(a).toHaveAttribute('target', '_blank')
    expect(a).toHaveAttribute('rel', 'noopener noreferrer')
    expect(a).toHaveTextContent('🎮 小遊戲')
  })

  it('FE-EXTRALINK-002: shows on the dashboard and on share pages', async () => {
    getAppConfig.mockResolvedValue({ extra_link: { url: 'https://arcade.example/', label: 'x' } })
    const { unmount } = render(<ExtraLinkButton />, { initialEntries: ['/dashboard'] })
    expect(await screen.findByTestId('extra-link-button')).toBeInTheDocument()
    unmount()
    render(<ExtraLinkButton />, { initialEntries: ['/shared/abc'] })
    expect(await screen.findByTestId('extra-link-button')).toBeInTheDocument()
  })

  it('FE-EXTRALINK-003: never renders (or fetches) on the login and register pages', async () => {
    getAppConfig.mockResolvedValue({ extra_link: { url: 'https://arcade.example/', label: 'x' } })
    render(<ExtraLinkButton />, { initialEntries: ['/login'] })
    await Promise.resolve()
    expect(screen.queryByTestId('extra-link-button')).toBeNull()
    expect(getAppConfig).not.toHaveBeenCalled()
  })

  it('FE-EXTRALINK-004: renders nothing when the server sends no extra_link', async () => {
    getAppConfig.mockResolvedValue({ extra_link: null })
    render(<ExtraLinkButton />, { initialEntries: ['/dashboard'] })
    await vi.waitFor(() => expect(getAppConfig).toHaveBeenCalled())
    await Promise.resolve()
    expect(screen.queryByTestId('extra-link-button')).toBeNull()
  })

  it('FE-EXTRALINK-005: sits above the trip page but under phone sheets, so it never covers a sheet button', async () => {
    getAppConfig.mockResolvedValue({ extra_link: { url: 'https://arcade.example/', label: '🎮 小遊戲' } })
    const { container } = render(<ExtraLinkButton />, { initialEntries: ['/trips/1'] })
    await screen.findByTestId('extra-link-button')
    const css = container.querySelector('style')?.textContent || ''
    const z = Number(css.match(/\.enscon-extra-link\{[^}]*z-index:(\d+)/)?.[1])
    expect(z).toBeGreaterThan(50) // MTripShell is z-50
    expect(z).toBeLessThan(60) // MSheet is z-60
  })
})
