import { describe, it, expect } from 'vitest';
import { parseItineraryText, maskSensitive, TextTooLongError, MAX_TEXT_CHARS } from '../../../../src/nest/text-import/rules';

// 三天行程：跨年，測試資料不含真人名字
const ctx = { dayDates: ['2026-12-31', '2027-01-01', '2027-01-02'] };
const parse = (t: string) => parseItineraryText(t, ctx);

describe('text-import rules', () => {
  it('12/31 與 1/1 對到行程日期（跨年），並切出站名與時間', () => {
    const { result, ok } = parse('12/31 早上 8 點取車→9 點出發去美麗海水族館，下午去備瀨福木林道，晚上回北谷住宿\n1/1 睡到飽，下午美國村逛街');
    expect(ok).toBe(true);
    expect(result.source).toBe('rules');
    expect(result.days.map(d => d.date)).toEqual(['2026-12-31', '2027-01-01']);
    expect(result.days[0].stops.map(s => s.name)).toEqual(['取車', '美麗海水族館', '備瀨福木林道', '回北谷住宿']);
    expect(result.days[0].stops[0].time).toBe('08:00');
    expect(result.days[0].stops[1].time).toBe('09:00');
    expect(result.days[1].stops.map(s => s.name)).toEqual(['睡到飽', '美國村逛街']);
  });

  it('12月31日 與 2026/12/31 寫法', () => {
    expect(parse('12月31日 去海邊').result.days[0].date).toBe('2026-12-31');
    expect(parse('2027/1/1 國際通').result.days[0].date).toBe('2027-01-01');
  });

  it('1/1(五) 星期括號會被吃掉', () => {
    const { result } = parse('1/1(五) 去國際通');
    expect(result.days[0].stops[0].name).toBe('國際通');
  });

  it('第N天（含中文數字）對到 dayIndex', () => {
    const { result } = parse('第一天 逛老街\n第三天 吃燒肉');
    expect(result.days.map(d => d.dayIndex)).toEqual([0, 2]);
    expect(result.days[1].date).toBe('2027-01-02');
  });

  it('Day N 與 D1 寫法', () => {
    const { result } = parse('Day 2：看夕陽\nD3 去機場');
    expect(result.days.map(d => d.dayIndex)).toEqual([1, 2]);
  });

  it('時間寫法：8:30、8點、上午八點半', () => {
    const { result } = parse('Day 1 8:30 集合、8點 早餐、上午八點半 出發');
    expect(result.days[0].stops.map(s => s.time)).toEqual(['08:30', '08:00', '08:30']);
  });

  it('下午／晚上時段詞與數字合併成 24 小時制', () => {
    const { result } = parse('Day 1 下午 3 點 咖啡廳，晚上七點 燒肉，中午 12 點 拉麵');
    expect(result.days[0].stops.map(s => s.time)).toEqual(['15:00', '19:00', '12:00']);
  });

  it('只有時段詞時不編造時間，原句留在 note', () => {
    const { result } = parse('Day 1 下午去備瀨福木林道');
    const s = result.days[0].stops[0];
    expect(s.time).toBeUndefined();
    expect(s.name).toBe('備瀨福木林道');
    expect(s.note).toBe('下午去備瀨福木林道');
  });

  it('口語「早一點／一點點／吃一點東西」不是一點鐘；晚上 12 點是 00:00', () => {
    const { result } = parse('Day 1 早一點出發、吃一點東西、一點點伴手禮、一點集合、晚上12點 看夜景');
    expect(result.days[0].stops.map(s => s.time)).toEqual([undefined, undefined, undefined, '01:00', '00:00']);
  });

  it('動詞前綴不會把「逛街」吃成「街」', () => {
    expect(parse('Day 1 14:30 逛街').result.days[0].stops[0].name).toBe('逛街');
  });

  it('沒有日期的文字全部進未歸類，ok=false', () => {
    const { result, ok } = parse('去海邊，吃海鮮');
    expect(ok).toBe(false);
    expect(result.days).toEqual([]);
    expect(result.unassigned.map(s => s.name)).toEqual(['海邊', '海鮮']);
  });

  it('日期對不到行程的天進未歸類並帶 label', () => {
    const { result, ok } = parse('1/1 國際通\n2/5 某個地方');
    expect(ok).toBe(false);
    expect(result.days).toHaveLength(1);
    expect(result.unassigned[0]).toMatchObject({ name: '某個地方', label: '2/5' });
  });

  it('Day N 超過行程天數進未歸類', () => {
    expect(parse('Day 9 回家').result.unassigned[0].label).toBe('Day 9');
  });

  it('同一天出現兩次會合併', () => {
    const { result } = parse('1/1 國際通\n1/1 牧志市場');
    expect(result.days).toHaveLength(1);
    expect(result.days[0].stops).toHaveLength(2);
  });

  it('全形數字與冒號也能解析', () => {
    const { result } = parse('１２/３１ ９：３０ 取車');
    expect(result.days[0].stops[0]).toMatchObject({ time: '09:30', name: '取車' });
  });

  it('空輸入與純空白：沒有任何結果', () => {
    for (const t of ['', '   \n  ']) {
      const { result, ok } = parse(t);
      expect(ok).toBe(false);
      expect(result.days).toEqual([]);
      expect(result.unassigned).toEqual([]);
    }
  });

  it('超過上限的輸入被拒', () => {
    expect(() => parse('a'.repeat(MAX_TEXT_CHARS + 1))).toThrow(TextTooLongError);
    expect(() => parse('a'.repeat(MAX_TEXT_CHARS))).not.toThrow();
  });

  it('行程沒排日期時，Day N 仍可對到 dayIndex（date 缺）', () => {
    const { result } = parseItineraryText('Day 1 去海邊', { dayDates: [null, null] });
    expect(result.days[0]).toMatchObject({ dayIndex: 0 });
    expect(result.days[0].date).toBeUndefined();
  });
});

describe('maskSensitive', () => {
  it('遮蔽身分證、16 位卡號、訂位代號', () => {
    const out = maskSensitive('身分證 A123456789 卡 1234 5678 9012 3456 訂位 AB12CD 結束');
    expect(out).not.toMatch(/A123456789|1234 5678|AB12CD/);
    expect(out.match(/\[已遮蔽\]/g)).toHaveLength(3);
  });

  it('全形、小寫、新式居留證、護照、15 位 AMEX、關鍵字後的純英文 PNR 也遮蔽', () => {
    const cases = [
      'Ａ１２３４５６７８９', // 全形身分證
      'a123456789', // 小寫
      'A812345678', // 新式居留證（第二碼 8／9）
      '護照 312345678', // 台灣護照 9 碼
      'TK1234567', // 外國護照樣式
      '3782 822463 10005', // AMEX 15 碼
      '訂位代號：QWERTY', // 純英文 PNR 靠關鍵字
      'PNR KXYZAB',
    ];
    for (const c of cases) expect(maskSensitive(c)).toContain('[已遮蔽]');
    expect(maskSensitive('訂位代號：QWERTY')).not.toContain('QWERTY');
    expect(maskSensitive('Ａ１２３４５６７８９')).not.toMatch(/A123456789|Ａ１２/);
  });

  it('一般文字與時間不被誤遮蔽', () => {
    for (const t of ['12/31 08:30 美麗海水族館 TOKYO 2026', '確認一下 12/31 早上 8 點', '預約 10:00 燒肉', '搭 BR198 回台灣']) {
      expect(maskSensitive(t)).toBe(t);
    }
  });
});
