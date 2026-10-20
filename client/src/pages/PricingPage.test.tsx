import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '../../tests/helpers/render'
import PricingPage from './PricingPage'

// FE-PAGE-PRICING-001 to FE-PAGE-PRICING-006
// PricingPage 只是把 usePricing 接到畫面上（usePricing 另有測試），這裡把 hook 換掉，逐一渲染各種狀態。

const mocks = vi.hoisted(() => ({ pricing: {} as Record<string, unknown> }))
vi.mock('./pricing/usePricing', () => ({ usePricing: () => mocks.pricing }))

const buy = vi.fn()
const setConsent = vi.fn()
const plan = {
  enabled: true, price_twd: 299, seats: 10, days_after_return: 30,
  consent_ver: '2026-10-20', terms_url: '/legal/terms', privacy_url: '/legal/privacy',
}

function setPricing(over: Record<string, unknown> = {}) {
  mocks.pricing = {
    plan, loadFailed: false, enabled: true, isAuthenticated: true, consent: false, setConsent,
    busy: false, error: null, canBuy: false, buy, canceled: false, ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  setPricing()
})

describe('PricingPage', () => {
  it('FE-PAGE-PRICING-001: 一頁講清楚價格、人數、效期、退款規則與條款連結', () => {
    render(<PricingPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ENSCON Trip')
    expect(screen.getByText('NT$299')).toBeInTheDocument()
    expect(screen.getByText('Sign-ups for 10 people')).toBeInTheDocument()
    expect(screen.getByText('Use it until 30 days after you get back')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Refunds' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/legal/terms')
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/legal/privacy')
    expect(screen.getByText(/7-day right of withdrawal does not apply/)).toBeInTheDocument()
  })

  it('FE-PAGE-PRICING-002: 同意框預設不勾，沒勾時購買鈕不能按', () => {
    render(<PricingPage />)
    const box = screen.getByRole('checkbox')
    expect(box).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Pay NT$299 and create the trip' })).toBeDisabled()
    fireEvent.click(box)
    expect(setConsent).toHaveBeenCalledWith(true)
  })

  it('FE-PAGE-PRICING-003: 勾了就能按，按下去呼叫 buy', () => {
    setPricing({ consent: true, canBuy: true })
    render(<PricingPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Pay NT$299 and create the trip' }))
    expect(buy).toHaveBeenCalled()
  })

  it('FE-PAGE-PRICING-004: 收費沒開 → 按鈕顯示「即將開放」且不能按', () => {
    setPricing({ enabled: false, plan: { ...plan, enabled: false } })
    render(<PricingPage />)
    expect(screen.getByRole('button', { name: 'Coming soon' })).toBeDisabled()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('FE-PAGE-PRICING-005: 沒登入 → 按鈕帶去登入', () => {
    setPricing({ isAuthenticated: false })
    render(<PricingPage />)
    const btn = screen.getByRole('button', { name: 'Sign in to buy' })
    expect(btn).toBeEnabled()
    fireEvent.click(btn)
    expect(buy).toHaveBeenCalled()
  })

  it('FE-PAGE-PRICING-006: 取消付款、條款更新的提示', () => {
    setPricing({ canceled: true, error: 'consentOutdated' })
    render(<PricingPage />)
    expect(screen.getByRole('status')).toHaveTextContent('Payment canceled')
    expect(screen.getByRole('alert')).toHaveTextContent('The terms were just updated')
  })
})
