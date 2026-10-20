import { Injectable } from '@nestjs/common';
import crypto from 'crypto';
import { TRIP_BILLING_CONSENT_VERSION, type BillingPlan, type BillingPurchase, type BillingPurchaseStatus } from '@trek/shared';
import { getAppUrl, readEnv } from '../../app-config';
import { DatabaseService } from '../database/database.service';
import { TripsService } from '../trips/trips.service';
import { TripInviteService } from '../trip-invite/trip-invite.service';
import { MailerService } from '../notifications/mailer/mailer.service';
import { logWarn } from '../audit/audit-log.logger';
import { createRecurCheckout, verifyRecurSignature } from './recur';

/**
 * ENSCON 旅程按趟收費：Recur 單次付款 → order.paid → 開一個空行程給付款人（他就是擁有者）＋產生行程邀請連結。
 * 方案：data/enscon-trip/billing-plan-20261020.md（Atlas 評 90）。跟方案的差異只有一格：方案建議另寫一支
 * Cloudflare Worker 用 admin 帳號開團再轉移擁有者；這裡直接在 App 裡開，付款人本來就登入了，
 * 行程一開始就掛在他名下，不用把 admin 憑證放到外面，也不用「轉移擁有者」那一步。
 *
 * 認人只看我們自己記的結帳 session（checkout_id）或結帳時寫進 metadata 的 purchase_ref，
 * 不看 Email（Recur 同一個 Email 只有一個顧客，曾經認錯人，方案 §1「誰付的錢」）。
 */

export type CheckoutResult =
  | { ok: true; url: string; ref: string }
  | { ok: false; status: number; error: 'billing_disabled' | 'consent_outdated' | 'recur_error' };

export interface WebhookResult {
  status: number;
  body: { ok: boolean; outcome?: string; error?: string };
}

interface PurchaseRow {
  id: number;
  ref: string;
  user_id: number | null;
  checkout_id: string | null;
  order_id: string | null;
  product_id: string;
  status: string;
  seats: number;
  amount: number | null;
  currency: string | null;
  payer_email: string | null;
  trip_id: number | null;
  paid_at: string | null;
}

interface RecurEvent {
  id: string;
  type: string;
  timestamp?: string;
  data: Record<string, unknown>;
}

type Outcome =
  | 'fulfilled' | 'already_fulfilled' | 'duplicate' | 'unmatched' | 'ignored' | 'recorded'
  | 'payment_failed' | 'refunded' | 'partially_refunded';

interface Applied {
  outcome: Outcome;
  purchaseId?: number;
  detail?: Record<string, unknown>;
  notify?: { to: string; ref: string; userId: number };
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const nowIso = () => new Date().toISOString();

@Injectable()
export class BillingService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly trips: TripsService,
    private readonly invites: TripInviteService,
    private readonly mailer: MailerService,
  ) {}

  /** 收費頁要顯示的東西。未登入也看得到；不含任何金鑰。 */
  plan(): BillingPlan {
    const b = readEnv().billing;
    return {
      enabled: b.enabled,
      price_twd: b.priceTwd,
      seats: b.seats,
      days_after_return: b.daysAfterReturn,
      consent_ver: TRIP_BILLING_CONSENT_VERSION,
      terms_url: b.termsUrl,
      privacy_url: b.privacyUrl,
    };
  }

  /**
   * 建 Recur 結帳。同意框（七日解除權排除的「事先同意」）由 DTO 擋 consent:true，這裡再對版本。
   * 結帳 session 建成功才寫一列 pending，連同同意時間與版本（billing-plan §4-1 第 2 點）。
   */
  async startCheckout(user: { id: number }, consentVer: string, fetchImpl: typeof fetch = fetch): Promise<CheckoutResult> {
    const b = readEnv().billing;
    if (!b.enabled) return { ok: false, status: 503, error: 'billing_disabled' };
    if (consentVer !== TRIP_BILLING_CONSENT_VERSION) return { ok: false, status: 409, error: 'consent_outdated' };

    const ref = crypto.randomBytes(18).toString('base64url');
    const appUrl = getAppUrl();
    const res = await createRecurCheckout({
      secretKey: b.secretKey,
      productId: b.productId,
      successUrl: `${appUrl}/billing/success?ref=${ref}`,
      cancelUrl: `${appUrl}/pricing?canceled=1`,
      externalCustomerId: `enscon-trip-${user.id}`,
      metadata: { source: 'enscon-trip', purchase_ref: ref, user_id: String(user.id) },
    }, fetchImpl);
    if (!res.ok) {
      logWarn(`[billing] Recur checkout failed status=${res.status} user=${user.id}`);
      return { ok: false, status: 502, error: 'recur_error' };
    }
    this.dbs.run(
      `INSERT INTO billing_purchases (ref, user_id, checkout_id, product_id, livemode, status, seats, consent_at, consent_ver)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      ref, user.id, res.id, b.productId, b.livemode ? 1 : 0, b.seats, nowIso(), consentVer,
    );
    return { ok: true, url: res.url, ref };
  }

  /** 付款人自己的那一筆。別人的 ref 一律當不存在。邀請連結只給仍是擁有者的人看。 */
  getPurchase(userId: number, ref: string): BillingPurchase | null {
    const row = this.dbs.get<PurchaseRow & { trip_title: string | null; trip_owner: number | null }>(
      `SELECT p.*, t.title AS trip_title, t.user_id AS trip_owner
       FROM billing_purchases p LEFT JOIN trips t ON t.id = p.trip_id
       WHERE p.ref = ? AND p.user_id = ?`,
      ref, userId,
    );
    if (!row) return null;
    const tripId = row.trip_id !== null && row.trip_owner === userId ? row.trip_id : null;
    const invite = tripId !== null && row.status === 'fulfilled' ? this.invites.get(tripId) : null;
    return {
      ref: row.ref,
      status: row.status as BillingPurchaseStatus,
      trip_id: tripId,
      trip_title: tripId !== null ? row.trip_title : null,
      invite_token: invite?.token ?? null,
      seats: row.seats,
      amount: row.amount,
      currency: row.currency,
      paid_at: row.paid_at,
    };
  }

  /**
   * Recur webhook。驗簽未設定（RECUR_WEBHOOK_SECRET 空）一律拒收 503；簽章不對 401；格式不對 400；
   * 其餘（含重送、對不上、不是我們的商品）回 200，Recur 才不會一直重送。處理中丟例外 → 交易整筆回滾、
   * 事件不記，Nest 回 500，Recur 會照官方的退避重送（1/2/4/8/16 分鐘）。
   */
  handleWebhook(raw: Buffer | undefined, signature: string | undefined): WebhookResult {
    const b = readEnv().billing;
    if (!b.webhookSecret) return { status: 503, body: { ok: false, error: 'webhook_not_configured' } };
    if (!raw || raw.length === 0) return { status: 400, body: { ok: false, error: 'empty_body' } };
    if (!verifyRecurSignature(b.webhookSecret, raw, signature)) return { status: 401, body: { ok: false, error: 'bad_signature' } };
    let evt: unknown;
    try {
      evt = JSON.parse(raw.toString('utf8'));
    } catch {
      return { status: 400, body: { ok: false, error: 'bad_json' } };
    }
    if (!isRecurEvent(evt)) return { status: 400, body: { ok: false, error: 'bad_payload' } };

    const applied = this.applyEvent(evt, b.productId);
    if (applied.notify) void this.notifyPayer(applied.notify);
    return { status: 200, body: { ok: true, outcome: applied.outcome } };
  }

  /** 一則事件＝一個交易：去重、處理、記錄一起成功或一起回滾。 */
  applyEvent(evt: RecurEvent, productId: string): Applied {
    return this.dbs.transaction((): Applied => {
      if (this.dbs.get('SELECT 1 FROM billing_events WHERE event_id = ?', evt.id)) return { outcome: 'duplicate' };
      const applied = this.route(evt, productId);
      this.dbs.run(
        'INSERT INTO billing_events (event_id, type, outcome, purchase_id, detail) VALUES (?, ?, ?, ?, ?)',
        evt.id, evt.type, applied.outcome, applied.purchaseId ?? null, applied.detail ? JSON.stringify(applied.detail) : null,
      );
      if (applied.outcome === 'unmatched') {
        // 付了錢卻對不上人：記下訂單號讓人手動對（不印 Email）
        logWarn(`[billing] unmatched ${evt.type} event=${evt.id} order=${str(evt.data.order_id) ?? str(evt.data.id) ?? '-'}`);
      }
      return applied;
    });
  }

  private route(evt: RecurEvent, productId: string): Applied {
    const d = evt.data;
    switch (evt.type) {
      case 'order.paid':
        return str(d.product_id) === productId ? this.onPaid(evt) : { outcome: 'ignored' };
      case 'checkout.completed':
        return str(d.product_id) === productId ? this.onCheckoutCompleted(d) : { outcome: 'ignored' };
      case 'order.payment_failed':
        return this.onPaymentFailed(d);
      case 'refund.succeeded':
        return this.onRefund(evt);
      case 'refund.created':
      case 'refund.failed': {
        const p = this.byOrder(d.order_id);
        return p ? { outcome: 'recorded', purchaseId: p.id, detail: { refund: str(d.id), status: str(d.status) } } : { outcome: 'ignored' };
      }
      default:
        return { outcome: 'ignored' };
    }
  }

  private byCheckout(v: unknown): PurchaseRow | undefined {
    const id = str(v);
    return id ? this.dbs.get<PurchaseRow>('SELECT * FROM billing_purchases WHERE checkout_id = ?', id) : undefined;
  }

  private byOrder(v: unknown): PurchaseRow | undefined {
    const id = str(v);
    return id ? this.dbs.get<PurchaseRow>('SELECT * FROM billing_purchases WHERE order_id = ?', id) : undefined;
  }

  private byRef(v: unknown): PurchaseRow | undefined {
    const ref = str(v);
    return ref ? this.dbs.get<PurchaseRow>('SELECT * FROM billing_purchases WHERE ref = ?', ref) : undefined;
  }

  /**
   * 付款成功 → 開團。認人：order.paid 帶的 checkout_id 對我們記的結帳 session（官方欄位）；
   * 對不到再看 metadata.purchase_ref（官方 order 事件沒列 metadata，有帶才用）。
   * 冪等兩層：事件 id 去重（上一層），加上同一筆購買已經有團、或同一張訂單已經開過，就不再開。
   */
  private onPaid(evt: RecurEvent): Applied {
    const d = evt.data;
    const orderId = str(d.order_id) ?? str(d.id);
    const meta = (d.metadata && typeof d.metadata === 'object' ? d.metadata : {}) as Record<string, unknown>;
    const purchase = this.byCheckout(d.checkout_id) ?? this.byRef(meta.purchase_ref);
    const detail = { order: orderId, checkout: str(d.checkout_id), amount: num(d.amount) };
    if (!purchase || purchase.user_id === null) return { outcome: 'unmatched', purchaseId: purchase?.id, detail };

    const sameOrder = orderId ? this.byOrder(orderId) : undefined;
    if (purchase.trip_id !== null || purchase.status === 'fulfilled' || (sameOrder && sameOrder.id !== purchase.id)) {
      return { outcome: 'already_fulfilled', purchaseId: purchase.id, detail };
    }
    if (purchase.status !== 'pending' && purchase.status !== 'payment_failed') {
      return { outcome: 'ignored', purchaseId: purchase.id, detail: { ...detail, status: purchase.status } };
    }
    const user = this.dbs.get<{ id: number; username: string }>('SELECT id, username FROM users WHERE id = ?', purchase.user_id);
    if (!user) return { outcome: 'unmatched', purchaseId: purchase.id, detail };

    const { tripId } = this.trips.create(user.id, { title: `${user.username} 的旅程` });
    this.invites.createOrRotate(tripId, user.id, null);

    const customer = (d.customer && typeof d.customer === 'object' ? d.customer : {}) as Record<string, unknown>;
    const email = str(customer.email) ?? str(d.customer_email) ?? purchase.payer_email;
    const at = nowIso();
    this.dbs.run(
      `UPDATE billing_purchases SET status = 'fulfilled', order_id = ?, amount = ?, currency = ?, payer_email = ?,
         trip_id = ?, paid_at = ?, fulfilled_at = ?, invoice_status = 'pending', updated_at = ? WHERE id = ?`,
      orderId, num(d.amount), str(d.currency), email, tripId, str(d.paid_at) ?? str(evt.timestamp) ?? at, at, at, purchase.id,
    );
    return {
      outcome: 'fulfilled',
      purchaseId: purchase.id,
      detail: { ...detail, trip: tripId },
      notify: email ? { to: email, ref: purchase.ref, userId: user.id } : undefined,
    };
  }

  /** 結帳完成（付款通知另外來）：只把付款 Email 記下來，給之後寄信、開發票用。 */
  private onCheckoutCompleted(d: Record<string, unknown>): Applied {
    const purchase = this.byCheckout(d.id);
    if (!purchase) return { outcome: 'ignored' };
    const customer = (d.customer && typeof d.customer === 'object' ? d.customer : {}) as Record<string, unknown>;
    const email = str(customer.email) ?? str(d.customer_email);
    if (email && !purchase.payer_email) {
      this.dbs.run('UPDATE billing_purchases SET payer_email = ?, updated_at = ? WHERE id = ?', email, nowIso(), purchase.id);
    }
    return { outcome: 'recorded', purchaseId: purchase.id };
  }

  private onPaymentFailed(d: Record<string, unknown>): Applied {
    const purchase = this.byCheckout(d.checkout_id) ?? this.byOrder(d.order_id ?? d.id);
    if (!purchase) return { outcome: 'ignored' };
    if (purchase.status !== 'pending') return { outcome: 'ignored', purchaseId: purchase.id, detail: { status: purchase.status } };
    this.dbs.run("UPDATE billing_purchases SET status = 'payment_failed', updated_at = ? WHERE id = ?", nowIso(), purchase.id);
    return { outcome: 'payment_failed', purchaseId: purchase.id };
  }

  /**
   * 退款成功（Recur 從商家後台發起）。全額退：狀態 refunded、把行程的邀請連結刪掉（之後的人進不來），
   * 行程本身留著（封存或刪除是 Joey 決定，方案 §4）。只退一部分：只記一筆，不收回（方案照抄 billing.ts 的規則）。
   * 部分退款官方沒有旗標，用 refunded_amount < original_amount 判斷（guides/webhooks/events.md）。
   */
  private onRefund(evt: RecurEvent): Applied {
    const d = evt.data;
    const purchase = this.byOrder(d.order_id);
    if (!purchase) return { outcome: 'ignored' };
    const refunded = num(d.refunded_amount) ?? num(d.amount);
    const original = num(d.original_amount) ?? purchase.amount;
    const partial = refunded !== null && original !== null && refunded < original;
    const detail = { refund: str(d.id), refunded, original };
    if (purchase.status === 'refunded') return { outcome: 'refunded', purchaseId: purchase.id, detail };
    const status = partial ? 'partially_refunded' : 'refunded';
    const at = nowIso();
    this.dbs.run(
      'UPDATE billing_purchases SET status = ?, refunded_amount = ?, refunded_at = ?, updated_at = ? WHERE id = ?',
      status, refunded, str(d.processed_at) ?? str(evt.timestamp) ?? at, at, purchase.id,
    );
    if (!partial && purchase.trip_id !== null) this.invites.remove(purchase.trip_id);
    return { outcome: status, purchaseId: purchase.id, detail };
  }

  /**
   * 開團後寄一封信到付款 Email。信裡只放「付款完成頁」的網址（要登入才看得到邀請連結），
   * 不直接放邀請連結：轉寄出去就會被別人用掉（方案 §3 第 ⑤ 步）。
   * 附上七日解除權的交付後告知（方案 §4-1 第 3 點）。沒設 SMTP 就不寄，付款完成頁照樣看得到。
   */
  async notifyPayer(n: { to: string; ref: string; userId: number }): Promise<boolean> {
    try {
      const appUrl = getAppUrl();
      const terms = readEnv().billing.termsUrl;
      const termsUrl = terms.startsWith('/') ? `${appUrl}${terms}` : terms;
      const target = `/billing/success?ref=${n.ref}`;
      const body = [
        '付款完成，你的旅程團已經開好了。',
        `打開這個網址，用付款時的帳號登入，就能看到邀請連結和下一步：${appUrl}${target}`,
        '',
        '你已同意付款後立即提供服務，依《通訊交易解除權合理例外情事適用準則》第 2 條第 5 款，不適用七日解除權。',
        `服務條款：${termsUrl}`,
      ].join('\n');
      return await this.mailer.sendEmail(n.to, '你的旅程團已開好', body, n.userId, target);
    } catch (err) {
      logWarn(`[billing] payer email failed ref=${n.ref}: ${(err as Error).message}`);
      return false;
    }
  }
}

function isRecurEvent(v: unknown): v is RecurEvent {
  const e = v as Partial<RecurEvent> | null;
  return !!e && typeof e.id === 'string' && e.id !== '' && typeof e.type === 'string'
    && !!e.data && typeof e.data === 'object' && !Array.isArray(e.data);
}
