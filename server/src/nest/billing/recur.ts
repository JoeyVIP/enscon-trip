import crypto from 'crypto';

/**
 * Recur（台灣金流，docs.recur.tw）的最小用法：建一次性結帳、驗 webhook 簽章。
 * 只放查證過的官方規格（2026-10-20 讀 docs.recur.tw 原文）：
 * - 建結帳：POST https://api.recur.tw/v1/checkout/sessions，`Authorization: Bearer sk_…`，
 *   body 用 snake_case：product_id、mode、success_url、cancel_url、external_customer_id、metadata；
 *   回 201 帶 id（cs_…）與 url（https://checkout.recur.tw/…）。沙箱與正式同一個網址，由金鑰前綴 sk_test_／sk_live_ 決定。
 *   （api-reference/checkout-sessions.md、api-reference.md）
 * - webhook 驗簽：`X-Recur-Signature`＝以 webhook secret（原字串，不做 base64 解碼）對「原始 request body」
 *   做 HMAC-SHA256，結果 base64。時間戳不在簽章範圍內，官方也沒寫容許時間差（查無），所以不做時間窗檢查；
 *   重放靠事件 id 去重擋。（guides/webhooks/delivery.md）
 */
export const RECUR_CHECKOUT_URL = 'https://api.recur.tw/v1/checkout/sessions';
export const RECUR_SIGNATURE_HEADER = 'x-recur-signature';
const CHECKOUT_TIMEOUT_MS = 10_000;

export function signRecurBody(secret: string, raw: Buffer | string): string {
  return crypto.createHmac('sha256', secret).update(raw).digest('base64');
}

/** 簽章對不上、沒帶簽章、沒有 secret 都是 false。比對用固定時間。 */
export function verifyRecurSignature(secret: string, raw: Buffer, header: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(signRecurBody(secret, raw));
  const given = Buffer.from(header.trim());
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export interface RecurCheckoutInput {
  secretKey: string;
  productId: string;
  successUrl: string;
  cancelUrl: string;
  externalCustomerId: string;
  metadata: Record<string, string>;
}

export type RecurCheckoutResult = { ok: true; id: string; url: string } | { ok: false; status: number };

/** 建一次性付款的結帳 session。網路錯誤、非 2xx、回應不像官方格式，一律當失敗（status 0＝沒拿到回應）。 */
export async function createRecurCheckout(input: RecurCheckoutInput, fetchImpl: typeof fetch = fetch): Promise<RecurCheckoutResult> {
  let res: Response;
  try {
    res = await fetchImpl(RECUR_CHECKOUT_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${input.secretKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        product_id: input.productId,
        mode: 'PAYMENT',
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        external_customer_id: input.externalCustomerId,
        metadata: input.metadata,
      }),
      signal: AbortSignal.timeout(CHECKOUT_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, status: 0 };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const j = body as { id?: unknown; url?: unknown } | null;
  if (!res.ok || typeof j?.id !== 'string' || typeof j?.url !== 'string' || !j.url.startsWith('https://')) {
    return { ok: false, status: res.status };
  }
  return { ok: true, id: j.id, url: j.url };
}
