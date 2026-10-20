import { useMemo, useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import Modal from '../shared/Modal'
import {
  addRowsToTrip, buildPreviewRows, importText, TEXT_IMPORT_MAX_CHARS,
  type PreviewRow,
} from '../../utils/textImport'

// 「貼上文字，自動排行程」入口與對話框（桌面側欄與手機計畫分頁共用）。
// 流程：貼文字 → 解析 → 預覽（依日期分組、可改名稱時間、可取消勾選、未歸類要指定日期）→ 加入行程。

type TFn = (key: string, params?: Record<string, any>) => string
type DayLite = { id: number; date?: string | null; title?: string | null; day_number?: number }

interface Props {
  tripId: number
  days: DayLite[]
  t: TFn
  onClose: () => void
  isOpen: boolean
  onAdded?: (n: number) => void
}

function errorKey(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status === 501) return 'twImport.llmOff'
  if (status === 429) return 'twImport.rateLimited'
  return 'twImport.error'
}

export function TextImportModal({ tripId, days, t, onClose, isOpen, onAdded }: Props) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<PreviewRow[] | null>(null)
  const [source, setSource] = useState<'rules' | 'llm'>('rules')
  const [llmAvailable, setLlmAvailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errKey, setErrKey] = useState<string | null>(null)

  const remaining = TEXT_IMPORT_MAX_CHARS - text.length
  const tooLong = remaining < 0
  const dayNo = (id: number) => days.findIndex(d => d.id === id) + 1

  const run = async (useLlm: boolean) => {
    setBusy(true)
    setErrKey(null)
    try {
      const res = await importText(tripId, text, useLlm)
      setSource(res.source)
      setLlmAvailable(res.llmAvailable === true)
      setRows(buildPreviewRows(res, days))
      // 按了 AI 再解析，伺服器卻退回規則結果（AI 逾時或失敗）：明講，不要看起來像沒反應
      if (useLlm && res.source !== 'llm') setErrKey('twImport.llmFailed')
    } catch (err) {
      setErrKey(errorKey(err))
    } finally {
      setBusy(false)
    }
  }

  const add = async () => {
    if (!rows) return
    setBusy(true)
    setErrKey(null)
    try {
      const n = await addRowsToTrip(tripId, rows)
      onAdded?.(n)
      setText('')
      setRows(null)
      onClose()
    } catch {
      // 伺服器端一個 transaction：失敗代表一站都沒加，行程沒被改動，可直接再試
      setErrKey('twImport.addFailed')
    } finally {
      setBusy(false)
    }
  }

  const patch = (key: string, p: Partial<PreviewRow>) =>
    setRows(rs => rs && rs.map(r => (r.key === key ? { ...r, ...p } : r)))

  // 依日期分組：已歸類的依 dayId；未歸類獨立一組
  const groups = useMemo(() => {
    const out: { dayId: number | null; rows: PreviewRow[] }[] = []
    for (const r of rows ?? []) {
      let g = out.find(x => x.dayId === r.dayId)
      if (!g) { g = { dayId: r.dayId, rows: [] }; out.push(g) }
      g.rows.push(r)
    }
    return out.sort((a, b) => (a.dayId == null ? 1 : b.dayId == null ? -1 : dayNo(a.dayId) - dayNo(b.dayId)))
  }, [rows, days]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = (rows ?? []).filter(r => r.checked && r.dayId != null && r.name.trim()).length
  const inputCls = 'rounded-md border border-edge-faint bg-transparent px-2 py-1 text-sm'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('twImport.title')} size="xl">
      {rows === null ? (
        <div className="flex flex-col gap-2">
          <textarea
            aria-label={t('twImport.title')}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={t('twImport.placeholder')}
            rows={10}
            className={`${inputCls} w-full`}
          />
          {/* 不用 maxLength：貼上超長文字時瀏覽器會默默切掉後半段（後面幾天就不見了），改成明講超過多少字 */}
          <div className={`text-xs ${tooLong ? 'text-red-600' : 'opacity-70'}`} data-testid="text-import-remaining" role={tooLong ? 'alert' : undefined}>
            {tooLong ? t('twImport.tooLong', { n: -remaining }) : t('twImport.remaining', { n: remaining })}
          </div>
          <div className="text-xs opacity-70">{t('twImport.privacy')}</div>
          {errKey && <div role="alert" className="text-sm text-red-600">{t(errKey)}</div>}
          <button type="button" disabled={busy || !text.trim() || tooLong} onClick={() => run(false)}
            className="self-end rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-text disabled:opacity-50">
            {busy ? t('twImport.parsing') : t('twImport.parse')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-xs opacity-70">{t('twImport.previewHint')}</div>
          {rows.length === 0 && <div className="text-sm">{t('twImport.noResult')}</div>}
          {groups.map(g => (
            <section key={g.dayId ?? 'none'} aria-label={g.dayId == null ? t('twImport.unassigned') : t('twImport.dayHeader', { n: dayNo(g.dayId) })}>
              <h4 className="mb-1 text-sm font-semibold">
                {g.dayId == null ? t('twImport.unassigned') : `${t('twImport.dayHeader', { n: dayNo(g.dayId) })}${days.find(d => d.id === g.dayId)?.date ? ` · ${days.find(d => d.id === g.dayId)!.date}` : ''}`}
              </h4>
              <ul className="flex flex-col gap-1">
                {g.rows.map(r => (
                  <li key={r.key} className="flex flex-wrap items-center gap-2">
                    <input type="checkbox" aria-label={r.name} checked={r.checked}
                      onChange={e => patch(r.key, { checked: e.target.checked })} />
                    <input type="time" aria-label={t('twImport.time')} value={r.time} className={inputCls}
                      onChange={e => patch(r.key, { time: e.target.value })} />
                    <input type="text" aria-label={t('twImport.name')} value={r.name} maxLength={200} className={`${inputCls} min-w-0 flex-1`}
                      onChange={e => patch(r.key, { name: e.target.value })} />
                    {r.dayId == null && (
                      <select aria-label={t('twImport.assignPrompt')} value="" className={inputCls}
                        onChange={e => patch(r.key, { dayId: e.target.value ? Number(e.target.value) : null, checked: !!e.target.value })}>
                        <option value="">{r.label ? `${r.label} · ${t('twImport.assignPrompt')}` : t('twImport.assignPrompt')}</option>
                        {days.map(d => <option key={d.id} value={d.id}>{t('twImport.dayHeader', { n: dayNo(d.id) })}{d.date ? ` · ${d.date}` : ''}</option>)}
                      </select>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {errKey && <div role="alert" className="text-sm text-red-600">{t(errKey)}</div>}
          <div className="text-xs opacity-70">{t('twImport.privacy')}</div>
          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => setRows(null)} className="rounded-lg border border-edge-faint px-3 py-1.5 text-sm">{t('twImport.back')}</button>
              {source === 'rules' && llmAvailable && (
                <button type="button" disabled={busy} onClick={() => run(true)} className="rounded-lg border border-edge-faint px-3 py-1.5 text-sm">{t('twImport.reparse')}</button>
              )}
            </div>
            <button type="button" disabled={busy || selected === 0} onClick={add}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-text disabled:opacity-50">
              {busy ? t('twImport.adding') : t('twImport.add', { n: selected })}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/** 入口按鈕（自帶 modal）。className 讓桌面工具列與手機動作格各自調樣式。 */
export function TextImportButton({ tripId, days, t, className, label }: {
  tripId: number
  days: DayLite[]
  t: TFn
  className?: string
  label?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} aria-label={t('twImport.entry')}>
        {label ?? <><ClipboardPaste size={13} strokeWidth={2} />{t('twImport.entry')}</>}
      </button>
      {open && <TextImportModal tripId={tripId} days={days} t={t} isOpen={open} onClose={() => setOpen(false)} />}
    </>
  )
}
