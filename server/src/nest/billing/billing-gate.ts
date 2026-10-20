import { HttpException } from '@nestjs/common';
import { readEnv } from '../../app-config';
import type { DatabaseService } from '../database/database.service';

/**
 * 開新團要不要先付款。只管「開新團」這一件事（建立、複製行程）：
 * - 收費關閉（RECUR_* 任一個空）→ 一律不用，行為跟沒有收費功能時一模一樣
 * - 管理員、被設成「免費主揪」的帳號 → 不用
 * - 其他人 → 要先在 /pricing 付款（付款後由 BillingService 開團）
 *
 * 加入別人的團（邀請連結、成員邀請）永遠不收錢，也不經過這裡；已經存在的行程
 * （例如沖繩團）與它的成員完全不受影響——這個檢查只在「新開一個團」的那一刻跑。
 *
 * 純函式＋傳入 DatabaseService，leaf 檔不屬於任何 module，TripsService 引用它不會造成模組循環。
 */
export const TRIP_PAYMENT_REQUIRED = 'TRIP_PAYMENT_REQUIRED';

export class TripPaymentRequiredError extends HttpException {
  constructor() {
    super({ error: 'Opening a new trip needs a purchase first (see /pricing).', code: TRIP_PAYMENT_REQUIRED }, 402);
  }
}

export function isFreeOrganizer(dbs: DatabaseService, userId: number): boolean {
  return !!dbs.get('SELECT 1 FROM billing_free_organizers WHERE user_id = ?', userId);
}

export function tripCreationNeedsPurchase(dbs: DatabaseService, userId: number): boolean {
  if (!readEnv().billing.enabled) return false;
  const user = dbs.get<{ role: string }>('SELECT role FROM users WHERE id = ?', userId);
  if (!user || user.role === 'admin') return false;
  return !isFreeOrganizer(dbs, userId);
}
