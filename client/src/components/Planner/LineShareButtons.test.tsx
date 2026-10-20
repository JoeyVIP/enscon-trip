// FE-PLANNER-LINESHARE-001 to FE-PLANNER-LINESHARE-006
import { render, screen, waitFor } from '../../../tests/helpers/render'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../../tests/helpers/msw/server'
import { LineDayShareButton, LineTripShareButton } from './LineShareButtons'

const t = (key: string) => key
const toast = { error: vi.fn() }
const trip = { title: '示範行程', start_date: '2026-10-21', end_date: '2026-10-25' }

describe('LineShareButtons', () => {
  let openSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    toast.error.mockClear()
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
  })
  afterEach(() => openSpy.mockRestore())

  it('FE-PLANNER-LINESHARE-001: 有權限時顯示可點的「分享行程到 LINE」按鈕', () => {
    render(<LineTripShareButton tripId={1} trip={trip} canManageShare t={t} toast={toast} />)
    expect(screen.getByRole('button', { name: 'twLineShare.shareTrip' })).toBeEnabled()
  })

  it('FE-PLANNER-LINESHARE-002: 沒有 share_manage 權限時按鈕禁用', () => {
    render(<LineTripShareButton tripId={1} trip={trip} canManageShare={false} t={t} toast={toast} />)
    expect(screen.getByRole('button', { name: 'twLineShare.shareTrip' })).toBeDisabled()
  })

  it('FE-PLANNER-LINESHARE-003: 已有連結就直接用，不再建立', async () => {
    const created = vi.fn()
    server.use(
      http.get('/api/trips/1/share-link', () => HttpResponse.json({ token: 'tok123' })),
      http.post('/api/trips/1/share-link', () => { created(); return HttpResponse.json({ token: 'new' }) }),
    )
    render(<LineTripShareButton tripId={1} trip={trip} canManageShare t={t} toast={toast} />)
    await userEvent.click(screen.getByRole('button', { name: 'twLineShare.shareTrip' }))
    await waitFor(() => expect(openSpy).toHaveBeenCalled())
    const url = String(openSpy.mock.calls[0][0])
    expect(decodeURIComponent(url)).toContain(`${window.location.origin}/shared/tok123`)
    expect(created).not.toHaveBeenCalled()
  })

  it('FE-PLANNER-LINESHARE-004: 沒有連結時建立，且只開行程與地圖', async () => {
    let body: Record<string, boolean> | null = null
    server.use(
      http.get('/api/trips/1/share-link', () => HttpResponse.json({ token: null })),
      http.post('/api/trips/1/share-link', async ({ request }) => {
        body = (await request.json()) as Record<string, boolean>
        return HttpResponse.json({ token: 'fresh' })
      }),
    )
    render(<LineTripShareButton tripId={1} trip={trip} canManageShare t={t} toast={toast} />)
    await userEvent.click(screen.getByRole('button', { name: 'twLineShare.shareTrip' }))
    await waitFor(() => expect(openSpy).toHaveBeenCalled())
    expect(body).toEqual({ share_map: true, share_bookings: false, share_packing: false, share_budget: false, share_collab: false })
    expect(decodeURIComponent(String(openSpy.mock.calls[0][0]))).toContain('/shared/fresh')
  })

  it('FE-PLANNER-LINESHARE-005: 建立失敗時顯示錯誤、不開 LINE', async () => {
    server.use(
      http.get('/api/trips/1/share-link', () => HttpResponse.json({ error: 'x' }, { status: 500 })),
    )
    render(<LineTripShareButton tripId={1} trip={trip} canManageShare t={t} toast={toast} />)
    await userEvent.click(screen.getByRole('button', { name: 'twLineShare.shareTrip' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('twLineShare.error'))
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('FE-PLANNER-LINESHARE-006: 單日按鈕出現，點了組出「時間 站名」文字並開 LINE', async () => {
    render(
      <LineDayShareButton
        tripId={1} date="2026-10-21" locale="en-US" title="Day one" canManageShare={false} t={t}
        stops={[{ name: 'Alpha Cafe', time: '09:30', lat: 25, lng: 121 }]}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'twLineShare.shareDay' }))
    expect(openSpy).toHaveBeenCalledTimes(1)
    const text = decodeURIComponent(String(openSpy.mock.calls[0][0]).split('?')[1])
    expect(text).toContain('09:30 Alpha Cafe')
    expect(text).toContain('query=25,121')
  })
})
