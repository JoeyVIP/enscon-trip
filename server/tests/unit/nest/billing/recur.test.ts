/** Recur 規格的最小實作：簽章（base64 HMAC-SHA256 over raw body）與一次性結帳的請求形狀。 */
import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';
import { createRecurCheckout, RECUR_CHECKOUT_URL, signRecurBody, verifyRecurSignature } from '../../../../src/nest/billing/recur';

const input = {
  secretKey: 'sk_test_unit_dummy',
  productId: 'prod_1',
  successUrl: 'https://trip.example/billing/success?ref=r1',
  cancelUrl: 'https://trip.example/pricing?canceled=1',
  externalCustomerId: 'enscon-trip-7',
  metadata: { purchase_ref: 'r1' },
};

describe('Recur webhook signature', () => {
  it('RECUR-001: 跟官方範例同一種算法：secret 原字串當 key、對原始 body 做 HMAC-SHA256、base64', () => {
    const raw = Buffer.from('{"id":"evt_1"}');
    const expected = crypto.createHmac('sha256', 'whsec_x').update(raw).digest('base64');
    expect(signRecurBody('whsec_x', raw)).toBe(expected);
    expect(verifyRecurSignature('whsec_x', raw, expected)).toBe(true);
  });

  it('RECUR-002: body 改一個字、secret 不同、沒帶簽章、沒有 secret 都不過', () => {
    const raw = Buffer.from('{"id":"evt_1"}');
    const sig = signRecurBody('whsec_x', raw);
    expect(verifyRecurSignature('whsec_x', Buffer.from('{"id":"evt_2"}'), sig)).toBe(false);
    expect(verifyRecurSignature('whsec_y', raw, sig)).toBe(false);
    expect(verifyRecurSignature('whsec_x', raw, undefined)).toBe(false);
    expect(verifyRecurSignature('', raw, sig)).toBe(false);
    expect(verifyRecurSignature('whsec_x', raw, 'short')).toBe(false);
  });
});

describe('createRecurCheckout', () => {
  it('RECUR-010: POST 官方網址、Bearer 金鑰、snake_case、mode PAYMENT', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ id: 'cs_1', url: 'https://checkout.recur.tw/cs_1' }), { status: 201 }));
    const res = await createRecurCheckout(input, f as unknown as typeof fetch);
    expect(res).toEqual({ ok: true, id: 'cs_1', url: 'https://checkout.recur.tw/cs_1' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(RECUR_CHECKOUT_URL);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk_test_unit_dummy');
    expect(JSON.parse(init.body as string)).toEqual({
      product_id: 'prod_1', mode: 'PAYMENT', success_url: input.successUrl, cancel_url: input.cancelUrl,
      external_customer_id: 'enscon-trip-7', metadata: { purchase_ref: 'r1' },
    });
  });

  it('RECUR-011: 非 2xx、不是 JSON、網址不是 https、網路錯誤都當失敗', async () => {
    const bad = (body: string, status: number) => vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;
    expect(await createRecurCheckout(input, bad('{"error":"x"}', 400))).toEqual({ ok: false, status: 400 });
    expect(await createRecurCheckout(input, bad('<html>', 200))).toEqual({ ok: false, status: 200 });
    expect(await createRecurCheckout(input, bad('{"id":"cs","url":"http://x"}', 201))).toEqual({ ok: false, status: 201 });
    const boom = vi.fn(async () => { throw new Error('down'); }) as unknown as typeof fetch;
    expect(await createRecurCheckout(input, boom)).toEqual({ ok: false, status: 0 });
  });
});
