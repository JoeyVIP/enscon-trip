import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '../../tests/helpers/render'
import BillingSuccessPage from './BillingSuccessPage'

// FE-PAGE-BILLOK-001 to 004
const mocks = vi.hoisted(() => ({ s: {} as Record<string, unknown> }))
vi.mock('./billing/useBillingSuccess', () => ({ useBillingSuccess: () => mocks.s }))

const copyInvite = vi.fn()
const openTrip = vi.fn()
const backToPricing = vi.fn()
const purchase = {
  ref: 'r1', status: 'fulfilled', trip_id: 5, trip_title: 'joey 的旅程', invite_token: 'tok',
  seats: 10, amount: 299, currency: 'TWD', paid_at: '2026-10-20T08:00:00.000Z',
}

function set(over: Record<string, unknown> = {}) {
  mocks.s = {
    state: 'fulfilled', purchase, inviteUrl: 'http://localhost/join/tok', copied: false,
    copyInvite, openTrip, backToPricing, slow: false, ...over,
  }
}

beforeEach(() => { vi.clearAllMocks(); set() })

describe('BillingSuccessPage', () => {
  it('FE-PAGE-BILLOK-001: 團開好了：邀請連結、打開行程、下一步、七日解除權告知', () => {
    render(<BillingSuccessPage />)
    expect(screen.getByRole('heading', { name: 'Your trip is ready' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'http://localhost/join/tok' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(copyInvite).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Open the trip' }))
    expect(openTrip).toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Next steps' })).toBeInTheDocument()
    expect(screen.getByText(/7-day right of withdrawal does not apply/)).toBeInTheDocument()
  })

  it('FE-PAGE-BILLOK-002: 還在等付款通知；等太久換成說明', () => {
    set({ state: 'pending', purchase: null, inviteUrl: null })
    const { rerender } = render(<BillingSuccessPage />)
    expect(screen.getByRole('heading', { name: 'Confirming your payment…' })).toBeInTheDocument()
    set({ state: 'pending', purchase: null, inviteUrl: null, slow: true })
    rerender(<BillingSuccessPage />)
    expect(screen.getByText(/taking longer than usual/)).toBeInTheDocument()
  })

  it('FE-PAGE-BILLOK-003: 邀請連結停用時說明怎麼重開', () => {
    set({ inviteUrl: null })
    render(<BillingSuccessPage />)
    expect(screen.getByText(/invite link is switched off/)).toBeInTheDocument()
  })

  it('FE-PAGE-BILLOK-004: 付款失敗／退款／找不到 → 說明並可回收費頁', () => {
    set({ state: 'failed' })
    const { rerender } = render(<BillingSuccessPage />)
    expect(screen.getByText(/did not go through/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to pricing' }))
    expect(backToPricing).toHaveBeenCalled()
    set({ state: 'refunded' })
    rerender(<BillingSuccessPage />)
    expect(screen.getByText(/was refunded/)).toBeInTheDocument()
    set({ state: 'notFound', purchase: null })
    rerender(<BillingSuccessPage />)
    expect(screen.getByText(/could not find this purchase/)).toBeInTheDocument()
  })
})
