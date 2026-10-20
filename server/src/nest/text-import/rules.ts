/**
 * 貼上 LINE 行程文字 → 每天每一站：規則解析（純函式，不碰 DB／網路）。
 *
 * 能處理：12/31、12月31日、2026/12/31、1/1(五)、第N天（含中文數字）、Day N、D1；
 * 8:30、8點、8點半、上午八點半、早上／中午／下午／晚上（有數字時換算 24 小時制；
 * 只有時段詞沒有數字時不編時間，保留在 note）。
 * 以「→ 、 ， ； 。 然後 接著 再去 之後 最後」切站，去掉「去／逛／吃／到／前往／出發去」前綴。
 * 不處理：日期區間（12/31-1/2）、沒有分隔符號的長句、「到」當分隔詞（太容易誤切地名）。
 */

export interface ParsedStop { time?: string; name: string; note?: string }
export interface ParsedDay { date?: string; dayIndex?: number; stops: ParsedStop[] }
export interface UnassignedStop extends ParsedStop { label?: string }
export interface ParseResult {
  days: ParsedDay[];
  unassigned: UnassignedStop[];
  source: 'rules' | 'llm';
}

/**
 * 輸入上限（字元）。超過一律拒絕，不截斷。前端（client/src/utils/textImport.ts）
 * 與 LLM 單次輸入用同一個數字，送 AI 時不會偷偷切掉後半段。
 */
export const MAX_TEXT_CHARS = 6000;

const MAX_NAME = 60;
const MAX_NOTE = 200;

const ZH_DIGIT: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/** 阿拉伯數字或中文數字（到 99）→ number，失敗回 null。 */
export function parseNum(s: string): number | null {
  if (/^\d+$/.test(s)) return Number(s);
  if (s === '十') return 10;
  const m = /^([一二兩三四五六七八九])?十([一二三四五六七八九])?$/.exec(s);
  if (m) return (m[1] ? ZH_DIGIT[m[1]] : 1) * 10 + (m[2] ? ZH_DIGIT[m[2]] : 0);
  if (s.length === 1 && s in ZH_DIGIT) return ZH_DIGIT[s];
  return null;
}

/** 全形數字與冒號轉半形，統一換行。 */
export function normalize(text: string): string {
  return text
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/：/g, ':')
    .replace(/\r\n?/g, '\n');
}

// ---------- 遮蔽（送 LLM 前） ----------
const MASK = '[已遮蔽]';
/** 關鍵字後面接的代號（含純英文的 PNR，例如「訂位代號：QWERTY」「護照號碼 E12345678」）。 */
const RE_KEYWORD_CODE = new RegExp(
  '((?:訂位|訂房|訂單|確認碼|確認編號|確認號碼|預約代號|預約編號|預約碼|電子機票|機票號碼|票號|護照|PNR|booking|confirmation|reservation|passport)'
  + '(?:代號|代碼|編號|號碼|碼|號|ref(?:erence)?|code|number|no\\.?)?\\s*[:#]?\\s*)([A-Za-z0-9][A-Za-z0-9-]{3,19})(?![A-Za-z0-9])',
  'gi',
);
/**
 * 看起來像證件號、卡號、訂位代號的片段換成 [已遮蔽]。
 * 先做 NFKC：全形英數（Ａ１２３…）轉半形，避免用全形字繞過。
 */
export function maskSensitive(text: string): string {
  return text
    .normalize('NFKC')
    // 關鍵字＋代號（先做：純英文的 PNR 只能靠關鍵字認）
    .replace(RE_KEYWORD_CODE, (_m, lead: string) => `${lead}${MASK}`)
    // 13~19 位數字卡號（允許空白或 - 分隔；含 15 位 AMEX）
    .replace(/(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g, MASK)
    // 台灣身分證／居留證：1 英文 + 1、2（身分證）或 8、9（新式居留證）或 A~D（舊式居留證）+ 8 數字；大小寫都算
    .replace(/(?<![A-Za-z0-9])[A-Z][1289A-D]\d{8}(?![A-Za-z0-9])/gi, MASK)
    // 台灣護照：9 位數字
    .replace(/(?<![A-Za-z0-9])\d{9}(?![A-Za-z0-9])/g, MASK)
    // 訂位代號／外國護照樣式：6~10 碼大寫英數混合（需同時含字母與數字，例如 AB12CD、TK1234567）
    .replace(/(?<![A-Za-z0-9])(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{6,10}(?![A-Za-z0-9])/g, MASK);
}

// ---------- 日期標記 ----------
type Marker =
  | { kind: 'md'; month: number; day: number }
  | { kind: 'index'; n: number };

interface MarkerHit { marker: Marker; rest: string; label: string }

const WEEKDAY = '(?:[（(][一二三四五六日天][)）]|週[一二三四五六日]|星期[一二三四五六日天])?';
const LEAD = '^[\\s\\-•・*#【\\[]*';
const RE_MD = new RegExp(`${LEAD}(?:\\d{4}\\s*[/年.]\\s*)?(\\d{1,2})\\s*[/月]\\s*(\\d{1,2})\\s*日?\\s*${WEEKDAY}\\s*[】\\]]?[\\s:：,，、\\-]*`);
const RE_NTH = new RegExp(`${LEAD}第\\s*([0-9一二兩三四五六七八九十]{1,3})\\s*天\\s*[】\\]]?[\\s:：,，、\\-]*`);
const RE_DAYN = new RegExp(`${LEAD}(?:day|d)\\s*(\\d{1,2})(?!\\d)\\s*[】\\]]?[\\s:：,，、\\-]*`, 'i');

function matchMarker(line: string): MarkerHit | null {
  let m = RE_NTH.exec(line);
  if (m) {
    const n = parseNum(m[1]);
    if (n && n >= 1) return { marker: { kind: 'index', n }, rest: line.slice(m[0].length), label: `第${n}天` };
  }
  m = RE_DAYN.exec(line);
  if (m) return { marker: { kind: 'index', n: Number(m[1]) }, rest: line.slice(m[0].length), label: `Day ${Number(m[1])}` };
  m = RE_MD.exec(line);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { marker: { kind: 'md', month, day }, rest: line.slice(m[0].length), label: `${month}/${day}` };
    }
  }
  return null;
}

// ---------- 時間 ----------
const NUM = '[0-9一二兩三四五六七八九十]{1,3}';
const PERIOD = '(凌晨|清晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜晚|午夜)';
const RE_CLOCK = new RegExp(`${PERIOD}?\\s*(\\d{1,2}):(\\d{2})`);
const RE_POINT = new RegExp(`${PERIOD}?\\s*(${NUM})\\s*[點点時时](?:\\s*(半)|\\s*(${NUM})\\s*分?)?`, 'g');
/** 口語的「一點」不是一點鐘：早一點、晚一點、多一點、快一點、一點點。 */
const CASUAL_YI_BEFORE = /[早晚快慢多少好差再有]$/;
const RE_PERIOD_ONLY = new RegExp(PERIOD);

function to24(period: string | undefined, h: number): number {
  // 晚上／夜晚 12 點是午夜（00:00），不是中午
  if ((period === '晚上' || period === '夜晚') && h === 12) return 0;
  if (period === '下午' || period === '傍晚' || period === '晚上' || period === '夜晚') return h < 12 ? h + 12 : h;
  if (period === '中午') return h < 11 ? h + 12 : h;
  if (period === '午夜') return h === 12 ? 0 : h;
  return h;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 從一段文字抽出第一個時間，回傳 HH:MM 與去掉時間後的文字。 */
export function extractTime(seg: string): { time?: string; rest: string } {
  const c = RE_CLOCK.exec(seg);
  if (c) {
    const h = to24(c[1], Number(c[2]));
    const min = Number(c[3]);
    if (h <= 23 && min <= 59) return { time: `${pad(h)}:${pad(min)}`, rest: seg.replace(c[0], ' ') };
  }
  for (const p of seg.matchAll(RE_POINT)) {
    const start = p.index ?? 0;
    const end = start + p[0].length;
    if (!p[1] && p[2] === '一' && !p[3] && !p[4]) {
      const after = seg.slice(end);
      if (CASUAL_YI_BEFORE.test(seg.slice(0, start).trimEnd()) || /^[點点]/.test(after) || /^(?:東西|時間|錢|吧)/.test(after)) continue;
    }
    const hRaw = parseNum(p[2]);
    const min = p[3] ? 30 : p[4] ? parseNum(p[4]) ?? 0 : 0;
    if (hRaw != null) {
      const h = to24(p[1], hRaw);
      if (h <= 23 && min <= 59) return { time: `${pad(h)}:${pad(min)}`, rest: `${seg.slice(0, start)} ${seg.slice(end)}` };
    }
  }
  return { rest: seg };
}

// ---------- 切站 ----------
const SPLIT = /→|➜|➔|->|=>|[、，,；;。]|然後|接著|再去|之後|最後|\s+>\s+/;
const PREFIX = /^(?:出發(?:去|到|前往)?|前往|再去|去|逛|吃|到|再)+/;

function cleanName(raw: string): string {
  let s = raw.replace(RE_PERIOD_ONLY, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^[\s:：\-~～]+/, '').replace(/[\s。！!～~等]+$/, '').trim();
  // 去掉動詞前綴，但剩不到 2 字就保留（例如「逛街」不能變成「街」）
  const stripped = s.replace(PREFIX, '').trim();
  if (stripped.length >= 2) s = stripped;
  return s.length > MAX_NAME ? s.slice(0, MAX_NAME) : s;
}

export function parseSegment(seg: string): ParsedStop | null {
  const original = seg.trim();
  if (!original) return null;
  const { time, rest } = extractTime(original);
  const name = cleanName(rest);
  if (!name) return null;
  const note = original.slice(0, MAX_NOTE);
  return { ...(time ? { time } : {}), name, ...(note !== name ? { note } : {}) };
}

export function splitStops(text: string): ParsedStop[] {
  return text.split(SPLIT).map(parseSegment).filter((s): s is ParsedStop => s !== null);
}

// ---------- 對應行程的天 ----------
/** dayDates：行程每一天的日期（YYYY-MM-DD；未排日期的天為 null），順序即 day 順序。 */
export interface DayContext { dayDates: (string | null)[] }

export function resolveDay(marker: Marker, ctx: DayContext): { date?: string; dayIndex: number } | null {
  const dates = ctx.dayDates;
  if (marker.kind === 'index') {
    const i = marker.n - 1;
    if (i < 0 || i >= dates.length) return null;
    return { dayIndex: i, ...(dates[i] ? { date: dates[i] as string } : {}) };
  }
  const key = `${pad(marker.month)}-${pad(marker.day)}`;
  const i = dates.findIndex(d => d != null && d.slice(5) === key);
  if (i < 0) return null;
  return { dayIndex: i, date: dates[i] as string };
}

/** 規則與 LLM 共用：把「帶標記的原始天」放進行程的 days，對不到的進未歸類。 */
export function placeDays(
  raw: { marker: Marker | null; label?: string; stops: ParsedStop[] }[],
  ctx: DayContext,
  source: 'rules' | 'llm',
): ParseResult {
  const byIndex = new Map<number, ParsedDay>();
  const unassigned: UnassignedStop[] = [];
  for (const r of raw) {
    const resolved = r.marker ? resolveDay(r.marker, ctx) : null;
    if (!resolved) {
      for (const s of r.stops) unassigned.push(r.label ? { ...s, label: r.label } : s);
      continue;
    }
    const day = byIndex.get(resolved.dayIndex) ?? { ...resolved, stops: [] };
    day.stops.push(...r.stops);
    byIndex.set(resolved.dayIndex, day);
  }
  const days = [...byIndex.values()].filter(d => d.stops.length > 0).sort((a, b) => (a.dayIndex ?? 0) - (b.dayIndex ?? 0));
  return { days, unassigned, source };
}

export type { Marker };

export class TextTooLongError extends Error {}

/**
 * 規則解析。ok=true 代表「至少 1 天且每個出現的日期標記都有至少 1 站、沒有未歸類」，
 * 此時可直接用 source:'rules'；否則呼叫端可改走 LLM（結果仍可當後備顯示）。
 */
export function parseItineraryText(text: string, ctx: DayContext): { result: ParseResult; ok: boolean } {
  if (text.length > MAX_TEXT_CHARS) throw new TextTooLongError('text too long');
  const lines = normalize(text).split('\n');
  const groups: { marker: Marker | null; label?: string; stops: ParsedStop[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let hadEmptyMarker = false;
  for (const line of lines) {
    if (!line.trim()) continue;
    const hit = matchMarker(line);
    let body = line;
    if (hit) {
      if (current && current.stops.length === 0) hadEmptyMarker = true;
      current = { marker: hit.marker, label: hit.label, stops: [] };
      groups.push(current);
      body = hit.rest;
    } else if (!current) {
      current = { marker: null, stops: [] };
      groups.push(current);
    }
    current!.stops.push(...splitStops(body));
  }
  if (current && current.stops.length === 0) hadEmptyMarker = true;
  const result = placeDays(groups, ctx, 'rules');
  const ok = result.days.length >= 1 && result.unassigned.length === 0 && !hadEmptyMarker;
  return { result, ok };
}
