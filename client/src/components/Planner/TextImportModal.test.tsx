// FE-PLANNER-TEXTIMPORT-001 to FE-PLANNER-TEXTIMPORT-007
import { render, screen, waitFor, within } from '../../../tests/helpers/render'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../../tests/helpers/msw/server'
import { TextImportModal } from './TextImportModal'

const t = (key: string, params?: Record<string, any>) => (params ? `${key}:${JSON.stringify(params)}` : key)
const days = [
  { id: 11, date: '2026-12-31' },
  { id: 12, date: '2027-01-01' },
]
const result = {
  source: 'rules',
  days: [
    { date: '2026-12-31', dayIndex: 0, stops: [{ time: '08:00', name: '取車' }, { name: '美麗海水族館' }] },
    { date: '2027-01-01', dayIndex: 1, stops: [{ name: '國際通' }] },
  ],
  unassigned: [{ name: '某個地方', label: '2/5' }],
}

async function openPreview() {
  server.use(http.post('/api/trips/1/import-text', () => HttpResponse.json(result)))
  render(<TextImportModal tripId={1} days={days} t={t} isOpen onClose={() => {}} />)
  await userEvent.type(screen.getByRole('textbox'), '12/31 取車')
  await userEvent.click(screen.getByRole('button', { name: 'twImport.parse' }))
  await screen.findByText('twImport.previewHint')
}

describe('TextImportModal', () => {
  it('FE-PLANNER-TEXTIMPORT-001: 顯示剩餘字數與隱私提示', async () => {
    render(<TextImportModal tripId={1} days={days} t={t} isOpen onClose={() => {}} />)
    expect(screen.getByTestId('text-import-remaining')).toHaveTextContent('{"n":6000}')
    await userEvent.type(screen.getByRole('textbox'), 'abc')
    expect(screen.getByTestId('text-import-remaining')).toHaveTextContent('{"n":5997}')
    expect(screen.getByText('twImport.privacy')).toBeInTheDocument()
  })

  it('FE-PLANNER-TEXTIMPORT-002: 預覽依日期分組', async () => {
    await openPreview()
    const d1 = screen.getByRole('region', { name: 'twImport.dayHeader:{"n":1}' })
    expect(within(d1).getAllByRole('textbox', { name: 'twImport.name' })).toHaveLength(2)
    const d2 = screen.getByRole('region', { name: 'twImport.dayHeader:{"n":2}' })
    expect(within(d2).getByDisplayValue('國際通')).toBeInTheDocument()
  })

  it('FE-PLANNER-TEXTIMPORT-003: 未歸類獨立一組，預設不勾選並可指定日期', async () => {
    await openPreview()
    const un = screen.getByRole('region', { name: 'twImport.unassigned' })
    const box = within(un).getByRole('checkbox')
    expect(box).not.toBeChecked()
    await userEvent.selectOptions(within(un).getByRole('combobox'), '12')
    await waitFor(() => expect(screen.getByRole('region', { name: 'twImport.dayHeader:{"n":2}' })).toHaveTextContent('某個地方'))
  })

  it('FE-PLANNER-TEXTIMPORT-004: 取消勾選會減少加入站數', async () => {
    await openPreview()
    expect(screen.getByRole('button', { name: 'twImport.add:{"n":3}' })).toBeEnabled()
    await userEvent.click(screen.getByRole('checkbox', { name: '取車' }))
    expect(screen.getByRole('button', { name: 'twImport.add:{"n":2}' })).toBeEnabled()
  })

  it('FE-PLANNER-TEXTIMPORT-005: 加入行程一次送出所有勾選的站（伺服器端 transaction），不再逐站呼叫 places／assignments', async () => {
    const bodies: { stops: Record<string, unknown>[] }[] = []
    let perStopCalls = 0
    server.use(
      http.post('/api/trips/1/import-text/apply', async ({ request }) => {
        bodies.push((await request.json()) as { stops: Record<string, unknown>[] })
        return HttpResponse.json({ added: 3 })
      }),
      http.post('/api/trips/1/places', () => { perStopCalls++; return HttpResponse.json({ place: { id: 1 } }) }),
      http.post('/api/trips/1/days/:dayId/assignments', () => { perStopCalls++; return HttpResponse.json({ assignment: { id: 1 } }) }),
    )
    const onAdded = vi.fn()
    server.use(http.post('/api/trips/1/import-text', () => HttpResponse.json(result)))
    render(<TextImportModal tripId={1} days={days} t={t} isOpen onClose={() => {}} onAdded={onAdded} />)
    await userEvent.type(screen.getByRole('textbox'), '12/31 取車')
    await userEvent.click(screen.getByRole('button', { name: 'twImport.parse' }))
    await screen.findByText('twImport.previewHint')
    await userEvent.click(screen.getByRole('button', { name: 'twImport.add:{"n":3}' }))
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(3))
    expect(bodies).toHaveLength(1)
    expect(bodies[0].stops.map(s => s.dayId)).toEqual([11, 11, 12])
    expect(bodies[0].stops[0]).toEqual({ dayId: 11, name: '取車', time: '08:00' })
    expect(bodies[0].stops[1]).not.toHaveProperty('time')
    expect(bodies[0].stops[0]).not.toHaveProperty('lat')
    expect(perStopCalls).toBe(0)
  })

  it('FE-PLANNER-TEXTIMPORT-007: 加入失敗時說明行程沒被改動，預覽保留可再試', async () => {
    server.use(http.post('/api/trips/1/import-text/apply', () => HttpResponse.json({ error: 'Import failed; nothing was added' }, { status: 500 })))
    const onClose = vi.fn()
    server.use(http.post('/api/trips/1/import-text', () => HttpResponse.json(result)))
    render(<TextImportModal tripId={1} days={days} t={t} isOpen onClose={onClose} />)
    await userEvent.type(screen.getByRole('textbox'), '12/31 取車')
    await userEvent.click(screen.getByRole('button', { name: 'twImport.parse' }))
    await screen.findByText('twImport.previewHint')
    await userEvent.click(screen.getByRole('button', { name: 'twImport.add:{"n":3}' }))
    expect(await screen.findByText('twImport.addFailed')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'twImport.add:{"n":3}' })).toBeEnabled()
  })

  it('FE-PLANNER-TEXTIMPORT-006: 伺服器回 501 時顯示 AI 未開啟', async () => {
    await openPreview()
    server.use(http.post('/api/trips/1/import-text', () => HttpResponse.json({ error: 'x' }, { status: 501 })))
    await userEvent.click(screen.getByRole('button', { name: 'twImport.reparse' }))
    expect(await screen.findByText('twImport.llmOff')).toBeInTheDocument()
  })
})
