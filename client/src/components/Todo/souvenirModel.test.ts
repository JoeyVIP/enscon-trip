// 伴手禮純函式測試：分組、進度、拆分
import { describe, it, expect } from 'vitest'
import type { TodoItem } from '../../types'
import { groupSouvenirs, souvenirProgress, splitSouvenirs, SOUVENIR_TEMPLATE_CATEGORY_KEYS } from './souvenirModel'

const item = (o: Partial<TodoItem>): TodoItem => ({
  id: 1, trip_id: 1, name: '零食', category: null, checked: 0, sort_order: 0, due_date: null,
  description: null, assigned_user_id: null, priority: 0, kind: 'souvenir', quantity: 1, ...o,
})
const members = [{ id: 1, username: '小美' }, { id: 2, username: '小明' }]

describe('souvenirModel', () => {
  it('splitSouvenirs 把伴手禮與一般待辦拆開', () => {
    const { souvenirs, todos } = splitSouvenirs([item({ id: 1 }), item({ id: 2, kind: null })])
    expect(souvenirs.map(i => i.id)).toEqual([1])
    expect(todos.map(i => i.id)).toEqual([2])
  })

  it('souvenirProgress 算已買／共幾項', () => {
    expect(souvenirProgress([item({ id: 1, checked: 1 }), item({ id: 2 }), item({ id: 3 })])).toEqual({ bought: 1, total: 3 })
    expect(souvenirProgress([])).toEqual({ bought: 0, total: 0 })
  })

  it('依「給誰」分組，沒填的排最後，各組有自己的進度', () => {
    const groups = groupSouvenirs([
      item({ id: 1, recipient: '小美', checked: 1 }),
      item({ id: 2, recipient: '小美' }),
      item({ id: 3, recipient: '小明' }),
      item({ id: 4, recipient: null }),
    ], 'recipient', members)
    expect(groups.map(g => g.label)).toEqual(['小明', '小美', null])
    expect(groups.find(g => g.label === '小美')).toMatchObject({ bought: 1, total: 2 })
  })

  it('依「誰去買」分組，用成員名稱，未指派排最後', () => {
    const groups = groupSouvenirs([
      item({ id: 1, assigned_user_id: 2 }),
      item({ id: 2, assigned_user_id: 1 }),
      item({ id: 3, assigned_user_id: null }),
    ], 'buyer', members)
    expect(groups.map(g => g.label)).toEqual(['小明', '小美', null])
  })

  it('範本只有分類，沒有商品或價格', () => {
    expect(SOUVENIR_TEMPLATE_CATEGORY_KEYS).toHaveLength(4)
  })
})
