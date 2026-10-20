// 伴手禮清單元件測試：分組檢視切換、進度、範本
import { render, screen, waitFor, within } from '../../../tests/helpers/render'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../../tests/helpers/msw/server'
import { useAuthStore } from '../../store/authStore'
import { useTripStore } from '../../store/tripStore'
import { resetAllStores, seedStore } from '../../../tests/helpers/store'
import { buildUser, buildTrip, buildTodoItem } from '../../../tests/helpers/factories'
import SouvenirPanel from './SouvenirPanel'

const members = [{ id: 1, username: '小美' }, { id: 2, username: '小明' }]
const souvenir = (o: Record<string, unknown>) => buildTodoItem({ kind: 'souvenir', quantity: 1, ...o } as never)

beforeEach(() => {
  resetAllStores()
  seedStore(useAuthStore, { user: buildUser(), isAuthenticated: true })
  seedStore(useTripStore, { trip: buildTrip({ id: 1 }) })
})

describe('SouvenirPanel', () => {
  it('顯示已買 x／共 y 進度', () => {
    const items = [souvenir({ id: 1, name: '餅乾', checked: 1 }), souvenir({ id: 2, name: '藥膏' })]
    render(<SouvenirPanel tripId={1} items={items} members={members} />)
    expect(screen.getByTestId('souvenir-progress')).toHaveTextContent('1')
    expect(screen.getByTestId('souvenir-progress')).toHaveTextContent('2')
  })

  it('預設依給誰分組，切換後依誰去買分組', async () => {
    const user = userEvent.setup()
    const items = [
      souvenir({ id: 1, name: '餅乾', recipient: '小美', assigned_user_id: 2 }),
      souvenir({ id: 2, name: '藥膏', recipient: '小明', assigned_user_id: 2 }),
    ]
    render(<SouvenirPanel tripId={1} items={items} members={members} />)
    expect(screen.getAllByTestId('souvenir-group')).toHaveLength(2)

    const buttons = screen.getAllByRole('button', { pressed: false })
    await user.click(buttons[0])
    const groups = screen.getAllByTestId('souvenir-group')
    expect(groups).toHaveLength(1)
    expect(within(groups[0]).getByText('餅乾', { exact: false })).toBeInTheDocument()
    expect(within(groups[0]).getByText('藥膏', { exact: false })).toBeInTheDocument()
  })

  it('空清單時按範本鈕，建立四個分類品項', async () => {
    const user = userEvent.setup()
    const posted: Array<Record<string, unknown>> = []
    server.use(http.post('/api/trips/:id/todo', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      posted.push(body)
      return HttpResponse.json({ item: buildTodoItem({ id: 100 + posted.length, ...body } as never) })
    }))
    render(<SouvenirPanel tripId={1} items={[]} members={members} />)
    await user.click(screen.getByRole('button', { name: /Create souvenir list/ }))
    await waitFor(() => expect(posted).toHaveLength(4))
    expect(posted.every(p => p.kind === 'souvenir')).toBe(true)
    expect(posted.some(p => 'price_jpy' in p)).toBe(false)
  })
})
