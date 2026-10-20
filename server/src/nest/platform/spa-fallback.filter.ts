import { ArgumentsHost, Catch, ExceptionFilter, Inject, Logger, NotFoundException, Optional } from '@nestjs/common';
import type { Request, Response } from 'express';
import { readEnv } from '../../app-config';
import { cookieOptions } from '../common/cookie';
import { answerUnmatchedGet } from './platform.routes';
import {
  INVITE_COOKIE,
  INVITE_COOKIE_MAX_AGE_MS,
  INVITE_ENTRY_GATE,
  inviteFromEntryRequest,
  inviteLoginUrl,
  type InviteEntryGate,
} from './invite-entry';

/**
 * Serves the built SPA (index.html) for any request the NestJS router did not
 * match — the production single-page-app fallback. This replaces the legacy
 * Express `app.get('*')` catch-all, which cannot run on the Nest instance: Nest's
 * router terminates an unmatched request by throwing NotFoundException (it never
 * falls through to a post-init Express route), so the SPA fallback has to live
 * inside the Nest pipeline as a NotFound filter instead.
 *
 * Behaviour matches the legacy catch-all exactly: in production, an unmatched GET
 * returns index.html; everything else (non-GET, or dev where there is no built
 * client) keeps the standard TREK `{ error }` 404 envelope. The `@Catch(NotFoundException)`
 * is more specific than the global TrekExceptionFilter, so Nest routes 404s here
 * while every other error still flows through TrekExceptionFilter.
 *
 * A GET for a build file that is not on disk (a chunk of the previous release,
 * say) is not a page and gets the 404 envelope too, never index.html (#2524).
 *
 * ENSCON：/register?invite=X、/login?invite=X 在只給 LINE 登入的站上直接 302 去
 * /api/auth/oidc/login（見 invite-entry.ts）。gate 是選配的：沒注入（單元測試、e2e 的
 * 空模組）就跟原本一樣回 index.html。
 */
@Catch(NotFoundException)
export class SpaFallbackFilter implements ExceptionFilter {
  private readonly logger = new Logger('InviteEntry');

  constructor(@Optional() @Inject(INVITE_ENTRY_GATE) private readonly inviteGate?: InviteEntryGate) {}

  catch(exception: NotFoundException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    // Case-sensitive on purpose (legacy parity).
    if (readEnv().app.nodeEnv === 'production' && req.method === 'GET') {
      if (this.redirectInvite(req, res)) return;
      answerUnmatchedGet(req, res, exception.message || 'Not Found');
      return;
    }

    // Non-production, or a non-GET miss: keep the standard TREK 404 envelope
    // (identical to what TrekExceptionFilter produces for a NotFoundException).
    res.status(404).json({ error: exception.message || 'Not Found' });
  }

  /** 帶邀請碼的登入／註冊頁：條件都符合就 302 去 LINE 登入並回 true；否則什麼都不做、回 false。 */
  private redirectInvite(req: Request, res: Response): boolean {
    if (!this.inviteGate) return false;
    const invite = inviteFromEntryRequest(req);
    if (!invite) return false;
    let allowed = false;
    try {
      allowed = this.inviteGate.allowsInviteEntry(invite);
    } catch (err: unknown) {
      // 查設定或資料庫出錯就退回原行為（前端照樣能處理），不要讓邀請連結變成 500。
      this.logger.warn(`invite entry check failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
    if (!allowed) return false;
    // 前端讀得到的 cookie（httpOnly: false），跟 inviteStore 同名同屬性：LINE 登入失敗回登入頁時，
    // 「重試」鈕靠它補回邀請碼。
    res.cookie(INVITE_COOKIE, invite, { ...cookieOptions(false, req), httpOnly: false, maxAge: INVITE_COOKIE_MAX_AGE_MS });
    res.setHeader('Cache-Control', 'no-store');
    // 不記邀請碼的值。
    this.logger.log(`invite entry redirect path=${req.path} to=oidc_login`);
    res.redirect(302, inviteLoginUrl(invite));
    return true;
  }
}
