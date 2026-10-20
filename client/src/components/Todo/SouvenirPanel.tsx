import { useMemo, useState } from 'react'
import { useTripStore } from '../../store/tripStore'
import { useCanDo } from '../../store/permissionsStore'
import { useToast } from '../shared/Toast'
import { useTranslation } from '../../i18n'
import type { TodoItem } from '../../types'
import {
  SOUVENIR_KIND, SOUVENIR_TEMPLATE_CATEGORY_KEYS, groupSouvenirs, souvenirProgress,
  type SouvenirMember, type SouvenirView,
} from './souvenirModel'

/**
 * 伴手禮／代購清單（Lists 的第三個子分頁，桌面與手機共用）。
 * 資料就是 todo_items 中 kind='souvenir' 的列，所以即時同步、權限（packing_edit）
 * 都沿用待辦；這裡只負責分組檢視、進度、新增與範本。
 */
export default function SouvenirPanel({ tripId, items, members }: { tripId: number; items: TodoItem[]; members: SouvenirMember[] }) {
  const { addTodoItem, updateTodoItem, deleteTodoItem, toggleTodoItem } = useTripStore()
  const trip = useTripStore((s) => s.trip)
  const canEdit = useCanDo()('packing_edit', trip)
  const toast = useToast()
  const { t } = useTranslation()

  const [view, setView] = useState<SouvenirView>('recipient')
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [recipient, setRecipient] = useState('')
  const [buyerId, setBuyerId] = useState('')
  const [store, setStore] = useState('')
  const [price, setPrice] = useState('')

  const groups = useMemo(() => groupSouvenirs(items, view, members), [items, view, members])
  const { bought, total } = souvenirProgress(items)
  const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : t('common.error'))

  const add = () => {
    const n = name.trim()
    if (!n) return
    const qty = Math.max(1, Math.min(999, Math.floor(Number(quantity)) || 1))
    const yen = price.trim() === '' ? null : Math.max(0, Math.floor(Number(price)) || 0)
    addTodoItem(tripId, {
      name: n, kind: SOUVENIR_KIND, quantity: qty,
      recipient: recipient.trim() || null, store: store.trim() || null, price_jpy: yen,
      assigned_user_id: buyerId ? Number(buyerId) : null,
    })
      .then(() => { setName(''); setQuantity('1'); setRecipient(''); setStore(''); setPrice('') })
      .catch(onError)
  }

  // 範本：每個常見分類建一筆「分類名」品項當起點，使用者再改成實際品項；不含商品與價格。
  const createTemplate = () => {
    Promise.all(SOUVENIR_TEMPLATE_CATEGORY_KEYS.map(k =>
      addTodoItem(tripId, { name: t(k), category: t(k), kind: SOUVENIR_KIND, quantity: 1 }),
    )).catch(onError)
  }

  const input = 'rounded-lg border border-edge bg-surface-secondary px-2 py-1.5 text-sm text-content'

  return (
    <div className="flex flex-col gap-4 pb-6" data-testid="souvenir-panel">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="m-0 text-base font-semibold text-content">{t('twSouvenir.title')}</h3>
        <span className="text-sm text-content-muted" data-testid="souvenir-progress">
          {t('twSouvenir.progress', { bought, total })}
        </span>
        <div className="ml-auto inline-flex gap-1" role="group">
          {(['recipient', 'buyer'] as const).map(v => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
              className={`rounded-full px-3 py-1.5 text-sm ${view === v ? 'bg-accent text-accent-text' : 'bg-surface-secondary text-content'}`}>
              {t(v === 'recipient' ? 'twSouvenir.viewRecipient' : 'twSouvenir.viewBuyer')}
            </button>
          ))}
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder={t('twSouvenir.namePlaceholder')} aria-label={t('twSouvenir.name')} />
          <input className={`${input} w-16`} type="number" min={1} value={quantity} onChange={e => setQuantity(e.target.value)} aria-label={t('twSouvenir.quantity')} />
          <input className={input} list="souvenir-members" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder={t('twSouvenir.recipientPlaceholder')} aria-label={t('twSouvenir.recipient')} />
          <datalist id="souvenir-members">{members.map(m => <option key={m.id} value={m.username} />)}</datalist>
          <select className={input} value={buyerId} onChange={e => setBuyerId(e.target.value)} aria-label={t('twSouvenir.buyer')}>
            <option value="">{t('twSouvenir.unassigned')}</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
          </select>
          <input className={input} value={store} onChange={e => setStore(e.target.value)} placeholder={t('twSouvenir.storePlaceholder')} aria-label={t('twSouvenir.store')} />
          <input className={`${input} w-28`} type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} placeholder="JPY" aria-label={t('twSouvenir.price')} />
          <button type="button" onClick={add} className="rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-text">{t('twSouvenir.addItem')}</button>
        </div>
      )}

      {total === 0 && (
        <div className="flex flex-col items-start gap-2 text-sm text-content-muted">
          <span>{t('twSouvenir.empty')}</span>
          {canEdit && <button type="button" onClick={createTemplate} className="rounded-lg bg-accent px-3 py-1.5 text-accent-text">{t('twSouvenir.createTemplate')}</button>}
          <span className="text-xs">{t('twSouvenir.templateHint')}</span>
        </div>
      )}

      {groups.map(g => (
        <section key={g.key || '__none'} data-testid="souvenir-group" className="rounded-xl bg-surface-secondary p-3">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold text-content">
            <span>{g.label ?? t(view === 'recipient' ? 'twSouvenir.noRecipient' : 'twSouvenir.unassigned')}</span>
            <span className="font-normal text-content-muted">{t('twSouvenir.progress', { bought: g.bought, total: g.total })}</span>
          </div>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {g.items.map(i => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm text-content">
                <input type="checkbox" checked={!!i.checked} disabled={!canEdit} aria-label={i.name}
                  onChange={e => toggleTodoItem(tripId, i.id, e.target.checked)} />
                <span className={i.checked ? 'line-through opacity-60' : ''}>{i.name} ×{i.quantity ?? 1}</span>
                {view === 'buyer' && i.recipient && <span className="text-content-muted">→ {i.recipient}</span>}
                {view === 'recipient' && i.assigned_user_id != null && (
                  <span className="text-content-muted">{members.find(m => m.id === i.assigned_user_id)?.username}</span>
                )}
                {i.store && <span className="text-content-muted">@ {i.store}</span>}
                {i.price_jpy != null && <span className="text-content-muted">¥{i.price_jpy}</span>}
                {canEdit && (
                  <>
                    <select className={`${input} ml-auto`} value={i.assigned_user_id ?? ''} aria-label={t('twSouvenir.buyer')}
                      onChange={e => updateTodoItem(tripId, i.id, { assigned_user_id: e.target.value ? Number(e.target.value) : null }).catch(onError)}>
                      <option value="">{t('twSouvenir.unassigned')}</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                    </select>
                    <button type="button" aria-label={t('twSouvenir.delete')} onClick={() => deleteTodoItem(tripId, i.id).catch(onError)}>×</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
