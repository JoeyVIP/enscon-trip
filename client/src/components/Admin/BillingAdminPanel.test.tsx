import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '../../../tests/helpers/render'
import BillingAdminPanel from './BillingAdminPanel'

// FE-ADMIN-BILLING-001 to 003：面板只把 useBillingAdmin 接到畫面上，hook 換掉逐一渲染。
const mocks = vi.hoisted(() => ({ b: {} as Record<string, unknown> }))
vi.mock('./useBillingAdmin', () => ({ useBillingAdmin: () => mocks.b, EMPTY_PROMO: {} }))

const fns = {
  setDraft: vi.fn(), setLogin: vi.fn(), setOrganizerNote: vi.fn(),
  createPromo: vi.fn(), togglePromo: vi.fn(), addOrganizer: vi.fn(), removeOrganizer: vi.fn(),
}
const promo = { id: 1, code: 'FREE100', percent_off: 100, max_uses: 5, used_count: 2, expires_at: '2027-03-31T15:59:59.999Z', active: true, note: '試用', created_at: 'x' }
const organizer = { user_id: 3, username: 'tomato', email: 't@example.test', note: null, created_at: 'x' }

function set(over: Record<string, unknown> = {}) {
  mocks.b = {
    promos: [promo], organizers: [organizer],
    draft: { code: '', percentOff: '100', maxUses: '', expiresOn: '', note: '' },
    login: '', organizerNote: '', error: null, ...fns, ...over,
  }
}

beforeEach(() => { vi.clearAllMocks(); set() })

describe('BillingAdminPanel', () => {
  it('FE-ADMIN-BILLING-001: 列出優惠碼（折抵、已用／上限、到期日）並可停用', () => {
    render(<BillingAdminPanel />)
    expect(screen.getByText('FREE100')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('2 / 5')).toBeInTheDocument()
    expect(screen.getByText('2027-03-31')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Switch off' }))
    expect(fns.togglePromo).toHaveBeenCalledWith(promo)
  })

  it('FE-ADMIN-BILLING-002: 建立優惠碼：沒填代碼不能按；填了就送出', () => {
    render(<BillingAdminPanel />)
    expect(screen.getByRole('button', { name: 'Create code' })).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Code' }), { target: { value: 'TRY' } })
    expect(fns.setDraft).toHaveBeenCalledWith(expect.objectContaining({ code: 'TRY' }))
    set({ draft: { code: 'TRY', percentOff: '100', maxUses: '', expiresOn: '', note: '' } })
    render(<BillingAdminPanel />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Create code' })[1])
    expect(fns.createPromo).toHaveBeenCalled()
  })

  it('FE-ADMIN-BILLING-003: 免費主揪：列表、移除、找不到帳號的錯誤', () => {
    set({ error: 'userNotFound', login: 'x' })
    render(<BillingAdminPanel />)
    expect(screen.getByText('tomato')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(fns.removeOrganizer).toHaveBeenCalledWith(3)
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(fns.addOrganizer).toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('No account has that username or email.')
  })
})
