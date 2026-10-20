import { Body, Controller, Delete, Get, HttpCode, HttpException, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../../types';
import { Public } from '../auth/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { RateLimitService } from '../common/rate-limit.service';
import { BillingService } from './billing.service';
import { BillingCheckoutDto, BillingFreeOrganizerAddDto, BillingPromoCreateDto, BillingPromoUpdateDto } from './billing.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { AuditService } from '../audit/audit.service';
import { getClientIp } from '../audit/client-ip';
import { RECUR_SIGNATURE_HEADER } from './recur';

const CHECKOUT_WINDOW_MS = 15 * 60 * 1000;
const CHECKOUT_MAX = 10;

/**
 * /api/billing — ENSCON 旅程按趟收費。
 * plan 與 Recur webhook 是公開的（收費頁未登入也要看得到；Recur 拿不到我們的登入），其餘要登入。
 */
@Controller('api/billing')
export class BillingController {
  constructor(private readonly billing: BillingService, private readonly rl: RateLimitService) {}

  @Get('plan')
  @Public('The pricing page is shown before sign-in; it returns the price, seats and whether billing is on, never a key.')
  plan() {
    return this.billing.plan();
  }

  @Post('checkout')
  @HttpCode(200)
  async checkout(@CurrentUser() user: User, @Body() body: BillingCheckoutDto) {
    if (!this.rl.check('billing_checkout', String(user.id), CHECKOUT_MAX, CHECKOUT_WINDOW_MS, Date.now())) {
      throw new HttpException({ error: 'Too many attempts. Please try again later.' }, 429);
    }
    const res = await this.billing.startCheckout(user, body.consent_ver, body.promo_code);
    if ('error' in res) throw new HttpException({ error: res.error }, res.status);
    return { url: res.url, ref: res.ref };
  }

  /** 開新團要不要先付款（收費頁用來跟免費主揪說「直接開團就好」）。 */
  @Get('me')
  me(@CurrentUser() user: User) {
    return this.billing.me(user.id);
  }

  @Get('purchases/:ref')
  purchase(@CurrentUser() user: User, @Param('ref') ref: string) {
    const p = this.billing.getPurchase(user.id, ref);
    if (!p) throw new HttpException({ error: 'Purchase not found' }, 404);
    return p;
  }

  @Post('webhook/recur')
  @Public('Recur cannot hold an ENSCON Trip session; the HMAC-SHA256 X-Recur-Signature over the raw body is the authentication, and the route refuses everything while RECUR_WEBHOOK_SECRET is unset.')
  @HttpCode(200)
  recurWebhook(@Req() req: Request) {
    const raw = (req as Request & { rawBody?: Buffer }).rawBody;
    const res = this.billing.handleWebhook(raw, req.get(RECUR_SIGNATURE_HEADER));
    if (res.status !== 200) throw new HttpException(res.body, res.status);
    return res.body;
  }
}

/**
 * /api/billing/admin — 管理員後台：優惠碼（折抵 %、次數上限、到期日、開關）與免費主揪。
 * 每個寫入都記一筆稽核紀錄。
 */
@Controller('api/billing/admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class BillingAdminController {
  constructor(private readonly billing: BillingService, private readonly audit: AuditService) {}

  @Get('promo-codes')
  listPromos() {
    return { promo_codes: this.billing.listPromos() };
  }

  @Post('promo-codes')
  @HttpCode(201)
  createPromo(@CurrentUser() user: User, @Body() body: BillingPromoCreateDto, @Req() req: Request) {
    const res = this.billing.createPromo(user.id, body);
    if ('error' in res) throw new HttpException({ error: res.error }, 409);
    this.audit.writeAudit({ userId: user.id, action: 'billing.promo_create', resource: res.code, ip: getClientIp(req), details: { percent_off: res.percent_off, max_uses: res.max_uses, expires_at: res.expires_at } });
    return res;
  }

  @Put('promo-codes/:id')
  updatePromo(@CurrentUser() user: User, @Param('id') id: string, @Body() body: BillingPromoUpdateDto, @Req() req: Request) {
    const res = this.billing.setPromoActive(Number(id), body.active);
    if (!res) throw new HttpException({ error: 'Promo code not found' }, 404);
    this.audit.writeAudit({ userId: user.id, action: body.active ? 'billing.promo_enable' : 'billing.promo_disable', resource: res.code, ip: getClientIp(req) });
    return res;
  }

  @Get('free-organizers')
  listFreeOrganizers() {
    return { free_organizers: this.billing.listFreeOrganizers() };
  }

  @Post('free-organizers')
  @HttpCode(201)
  addFreeOrganizer(@CurrentUser() user: User, @Body() body: BillingFreeOrganizerAddDto, @Req() req: Request) {
    const res = this.billing.addFreeOrganizer(user.id, body.login, body.note);
    if ('error' in res) throw new HttpException({ error: res.error }, 404);
    this.audit.writeAudit({ userId: user.id, action: 'billing.free_organizer_add', resource: String(res.user_id), ip: getClientIp(req) });
    return res;
  }

  @Delete('free-organizers/:userId')
  removeFreeOrganizer(@CurrentUser() user: User, @Param('userId') userId: string, @Req() req: Request) {
    if (!this.billing.removeFreeOrganizer(Number(userId))) throw new HttpException({ error: 'Not a free organizer' }, 404);
    this.audit.writeAudit({ userId: user.id, action: 'billing.free_organizer_remove', resource: userId, ip: getClientIp(req) });
    return { success: true };
  }
}
