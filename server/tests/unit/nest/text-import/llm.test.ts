import { describe, it, expect, vi } from 'vitest';
import { parseWithLlm } from '../../../../src/nest/text-import/llm';

const ctx = { dayDates: ['2026-12-31', '2027-01-01'] };
const okBody = (content: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200 });

describe('parseWithLlm (mock fetch，沒有真的呼叫 OpenAI)', () => {
  it('合格 JSON：依日期放進 days，source=llm，並用 json_schema 與 Bearer 金鑰呼叫', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okBody({
      days: [{ date: '2027-01-01', dayIndex: null, stops: [{ time: '10:00', name: '國際通', note: null }] }],
      unassigned: [{ time: null, name: '某處', note: '原句' }],
    }));
    const r = await parseWithLlm('1/1 10點國際通', ctx, 'sk-test', { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r?.source).toBe('llm');
    expect(r?.days[0]).toMatchObject({ date: '2027-01-01', dayIndex: 1, stops: [{ time: '10:00', name: '國際通' }] });
    expect(r?.unassigned[0].name).toBe('某處');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.response_format.type).toBe('json_schema');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
  });

  it('送出前遮蔽身分證字號', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okBody({ days: [], unassigned: [] }));
    await parseWithLlm('A123456789 去海邊', ctx, 'k', { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl.mock.calls[0][1].body).not.toContain('A123456789');
  });

  it('不合格 JSON（時間格式錯、缺欄位、非 JSON）整包丟棄回 null', async () => {
    const bad = [
      { days: [{ date: null, dayIndex: 0, stops: [{ time: '25:99', name: 'x', note: null }] }], unassigned: [] },
      { days: 'oops' },
    ];
    for (const b of bad) {
      const f = vi.fn().mockResolvedValue(okBody(b));
      expect(await parseWithLlm('t', ctx, 'k', { fetchImpl: f as unknown as typeof fetch })).toBeNull();
    }
    const notJson = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'hello' } }] })));
    expect(await parseWithLlm('t', ctx, 'k', { fetchImpl: notJson as unknown as typeof fetch })).toBeNull();
  });

  it('HTTP 錯誤回 null', async () => {
    const f = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }));
    expect(await parseWithLlm('t', ctx, 'k', { fetchImpl: f as unknown as typeof fetch })).toBeNull();
  });

  it('逾時（abort）回 null', async () => {
    const f = vi.fn((_url: string, init: RequestInit) => new Promise((_res, rej) => {
      init.signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
    }));
    expect(await parseWithLlm('t', ctx, 'k', { fetchImpl: f as unknown as typeof fetch, timeoutMs: 20 })).toBeNull();
  });
});
