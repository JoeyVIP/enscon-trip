import { Body, Controller, Get, HttpCode, HttpException, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../../types';
import { Public } from '../auth/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { RateLimitService } from '../common/rate-limit.service';
import { BillingService } from './billing.service';
import { BillingCheckoutDto } from './billing.dto';
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
    const res = await this.billing.startCheckout(user, body.consent_ver);
    if (!res.ok) throw new HttpException({ error: res.error }, res.status);
    return { url: res.url, ref: res.ref };
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
