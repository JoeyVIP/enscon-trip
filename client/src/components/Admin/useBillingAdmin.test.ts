// FE-ADMIN-BILLING-HOOK-001 to 003
import { act, renderHook, waitFor } from '@testing-library/react'
import { billingAdminApi } from '../../api/billing'
import { useBillingAdmin } from './useBillingAdmin'

const promo = { id: 1, code: 'FREE100', percent_off: 100, max_uses: null, used_count: 0, expires_at: null, active: true, note: null, created_at: 'x' }

beforeEach(() => {
  vi.spyOn(billingAdminApi, 'listPromos').mockResolvedValue({ promo_codes: [promo] })
  vi.spyOn(billingAdminApi, 'listFreeOrganizers').mockResolvedValue({ free_organizers: [] })
  vi.spyOn(billingAdminApi, 'createPromo').mockResolvedValue(promo)
  vi.spyOn(billingAdminApi, 'setPromoActive').mockResolvedValue({ ...promo, active: false })
  vi.spyOn(billingAdminApi, 'addFreeOrganizer').mockResolvedValue({ user_id: 3, username: 'u', email: 'e', note: null, created_at: 'x' })
  vi.spyOn(billingAdminApi, 'removeFreeOrganizer').mockResolvedValue({ success: true })
})
afterEach(() => vi.restoreAllMocks())

describe('useBillingAdmin', () => {
  it('FE-ADMIN-BILLING-HOOK-001: 載入列表；建立優惠碼把表單轉成 API 格式', async () => {
    const { result } = renderHook(() => useBillingAdmin())
    await waitFor(() => expect(result.current.promos).toEqual([promo]))
    act(() => result.current.setDraft({ code: ' try ', percentOff: '50', maxUses: '3', expiresOn: '2027-03-31', note: '' }))
    await act(() => result.current.createPromo())
    expect(billingAdminApi.createPromo).toHaveBeenCalledWith({ code: 'try', percent_off: 50, max_uses: 3, expires_on: '2027-03-31', note: null })
    expect(result.current.draft.code).toBe('')
  })

  it('FE-ADMIN-BILLING-HOOK-002: 重複代碼 → promoExists；停用呼叫 API', async () => {
    vi.mocked(billingAdminApi.createPromo).mockRejectedValueOnce({ response: { status: 409 } })
    const { result } = renderHook(() => useBillingAdmin())
    await waitFor(() => expect(result.current.promos).toHaveLength(1))
    act(() => result.current.setDraft({ code: 'FREE100', percentOff: '100', maxUses: '', expiresOn: '', note: '' }))
    await act(() => result.current.createPromo())
    expect(result.current.error).toBe('promoExists')
    await act(() => result.current.togglePromo(promo))
    expect(billingAdminApi.setPromoActive).toHaveBeenCalledWith(1, false)
  })

  it('FE-ADMIN-BILLING-HOOK-003: 免費主揪：加入、找不到帳號、移除', async () => {
    const { result } = renderHook(() => useBillingAdmin())
    await waitFor(() => expect(result.current.promos).toHaveLength(1))
    act(() => result.current.setLogin('tomato'))
    await act(() => result.current.addOrganizer())
    expect(billingAdminApi.addFreeOrganizer).toHaveBeenCalledWith('tomato', '')
    vi.mocked(billingAdminApi.addFreeOrganizer).mockRejectedValueOnce({ response: { status: 404 } })
    act(() => result.current.setLogin('nobody'))
    await act(() => result.current.addOrganizer())
    expect(result.current.error).toBe('userNotFound')
    await act(() => result.current.removeOrganizer(3))
    expect(billingAdminApi.removeFreeOrganizer).toHaveBeenCalledWith(3)
  })
})
