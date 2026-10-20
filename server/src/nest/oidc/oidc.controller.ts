import { Body, Controller, Get, HttpException, Logger, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { oidcLoginQuerySchema } from '@trek/shared';
import { readEnv } from '../../app-config';
import { OidcService, OIDC_STATE_TTL_MS, OIDC_AUTH_CODE_TTL_MS } from './oidc.service';
import { cookieOptions } from '../common/cookie';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../../types';
import { AuditService } from '../audit/audit.service';
import { getClientIp } from '../audit/client-ip';
import { AdminOidcUpdateDto } from '../admin/admin.dto';
import { Public } from '../auth/public.decorator';
import { ManagedForbidden } from '../common/managed';

const OIDC_STATE_COOKIE = 'trek_oidc_state';
const OIDC_EXCHANGE_COOKIE = 'trek_oidc_exchange';

/**
 * /api/auth/oidc — OIDC SSO login flow (Authorization Code + PKCE).
 *
 * Carried over from the legacy Express route (server/src/routes/oidc.ts):
 * unauthenticated, the sso-disabled / not-configured / HTTPS-issuer guards, the
 * strict id_token + userinfo.sub cross-check, all the frontend redirect error
 * codes, and the auth-code → cookie hand-off on /exchange. Uses @Res directly
 * because the flow mixes provider redirects with JSON error bodies.
 *
 * Two cookies bind the flow to one browser, and both are single use: the state
 * cookie set at /login is required at /callback, and the binding cookie set at
 * /callback is required at /exchange. Neither the provider state nor the auth
 * code is a credential on its own — both travel in URLs.
 */
@Public('the OIDC handshake happens before an ENSCON Trip session exists; the provider state is the credential')
@Controller('api/auth/oidc')
export class OidcController {
  private readonly logger = new Logger(OidcController.name);

  constructor(
    private readonly oidc: OidcService,
    private readonly audit: AuditService,
  ) {}

  @Get('login')
  async login(@Req() req: Request, @Res() res: Response): Promise<void> {
    // 診斷日誌：每次進來留一行，只標有沒有帶邀請碼（不記值）。callback 那行到不了的環境
    // （例如 staging 被轉接層白名單擋在 LINE 之前）也能從這行看出邀請碼有沒有跟過來。
    const rawInvite = req.query?.invite;
    this.logger.log(`oidc login start hadInvite=${typeof rawInvite === 'string' && rawInvite.length > 0}`);
    if (!this.oidc.oidcLoginEnabled()) {
      res.status(403).json({ error: 'SSO login is disabled.' });
      return;
    }
    const config = this.oidc.getOidcConfig();
    if (!config) {
      res.status(400).json({ error: 'OIDC not configured' });
      return;
    }
    if (config.issuer && !config.issuer.startsWith('https://') && readEnv().app.isProduction) {
      res.status(400).json({ error: 'OIDC issuer must use HTTPS in production' });
      return;
    }
    try {
      const doc = await this.oidc.discover(config.issuer, config.discoveryUrl);
      const appUrl = this.oidc.getAppUrl();
      if (!appUrl) {
        res.status(500).json({ error: 'APP_URL is not configured. OIDC cannot be used.' });
        return;
      }
      // `(?<!\/)` as in oidc.service.ts: it pins the run to its own start so a trailing
      // run that does not end the string is not rescanned from every slash in it.
      const redirectUri = `${appUrl.replace(/(?<!\/)\/+$/, '')}/api/auth/oidc/callback`;
      // Lenient parse: a malformed query must never 400 a login redirect, so
      // unknown values simply fall back to the raw invite + default duration.
      const query = oidcLoginQuerySchema.safeParse(req.query);
      const inviteToken = query.success ? query.data.invite : (req.query.invite as string | undefined);
      const remember = query.success && query.data.remember !== undefined ? query.data.remember === '1' : undefined;
      const { state, codeChallenge } = this.oidc.createState(redirectUri, inviteToken, remember);
      // Bind the state to THIS browser. The callback requires a matching cookie,
      // so an attacker-initiated login (whose callback URL carries a valid state
      // from the shared server map) cannot be replayed in a victim's browser to
      // log them into the attacker's account (OIDC login CSRF / session fixation).
      // maxAge matches the server-side pending-state TTL — a cookie that
      // outlives its state entry could only ever produce invalid_state.
      res.cookie(OIDC_STATE_COOKIE, state, { ...cookieOptions(false, req), maxAge: OIDC_STATE_TTL_MS });
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: redirectUri,
        scope: readEnv().oidc.scope,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });
      res.redirect(`${doc.authorization_endpoint}?${params}`);
    } catch (err: unknown) {
      console.error('[OIDC] Login error:', err instanceof Error ? err.message : err);
      res.status(500).json({ error: 'OIDC login failed' });
    }
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oidcError: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const f = (p: string) => res.redirect(this.oidc.frontendUrl(p));
    // 診斷日誌：每次 callback 只留一行結果。不記 token、code、state、邀請碼值或任何個資，
    // 只標「有沒有帶邀請碼」，用來判斷使用者是不是掉了邀請碼。
    let hadInvite = false;
    const fail = (outcome: string, shown: string = outcome): void => {
      this.logger.warn(`oidc callback outcome=${outcome} hadInvite=${hadInvite}`);
      return f('/login?oidc_error=' + encodeURIComponent(shown));
    };

    // The state cookie is single-use — clear it regardless of the outcome.
    const boundState = (req.cookies as Record<string, string> | undefined)?.[OIDC_STATE_COOKIE];
    res.clearCookie(OIDC_STATE_COOKIE, cookieOptions(true, req));

    if (!this.oidc.oidcLoginEnabled()) return fail('sso_disabled');
    if (oidcError) {
      console.error('[OIDC] Provider error:', oidcError);
      return fail('provider_error', oidcError);
    }
    if (!code || !state) return fail('missing_params');

    // Require the callback to come from the browser that started the flow.
    // ENSCON：LINE App 內建瀏覽器開始登入、外部瀏覽器收 callback 時，state cookie 不會跟過去。
    // OIDC_ALLOW_CROSS_BROWSER_CALLBACK 開啟時「沒有 cookie」也放行，但「有 cookie 卻不符」照樣拒絕
    // （那是攻擊者把自己的流程塞給受害者的典型樣子）；state 仍須在 pendingStates 裡且一次性消耗。
    const allowMissingCookie = readEnv().oidc.allowCrossBrowserCallback && !boundState;
    if (!allowMissingCookie && (!boundState || boundState !== state)) return fail('invalid_state');

    const pending = this.oidc.consumeState(state);
    if (!pending) return fail('invalid_state');
    hadInvite = !!pending.inviteToken;

    const config = this.oidc.getOidcConfig();
    if (!config) return fail('not_configured');
    if (config.issuer && !config.issuer.startsWith('https://') && readEnv().app.isProduction) {
      return fail('issuer_not_https');
    }

    try {
      const doc = await this.oidc.discover(config.issuer, config.discoveryUrl);
      const tokenData = await this.oidc.exchangeCodeForToken(doc, code, pending.redirectUri, config.clientId, config.clientSecret, pending.codeVerifier);
      if (!tokenData._ok || !tokenData.access_token) {
        console.error('[OIDC] Token exchange failed: status', tokenData._status);
        return fail('token_failed');
      }
      if (!tokenData.id_token) {
        console.error('[OIDC] Token response missing id_token — refusing login');
        return fail('no_id_token');
      }
      const idVerify = await this.oidc.verifyIdToken(
        tokenData.id_token,
        doc,
        config.clientId,
        // Same trim as oidc.service.ts, and the same reason for the lookbehind — this one
        // runs over an issuer read out of a fetched discovery document.
        (doc.issuer ?? '').replace(/(?<!\/)\/+$/, '') || config.issuer,
      );
      if (idVerify.ok !== true) {
        const reason = 'error' in idVerify ? idVerify.error : 'unknown';
        console.error('[OIDC] id_token verification failed:', reason);
        return fail('id_token_invalid');
      }
      const userInfo = await this.oidc.getUserInfo(doc.userinfo_endpoint, tokenData.access_token);
      if (!userInfo.email) return fail('no_email');

      const tokenSub = idVerify.claims.sub;
      if (typeof tokenSub === 'string' && userInfo.sub && userInfo.sub !== tokenSub) {
        console.error('[OIDC] userinfo.sub does not match id_token.sub — refusing login');
        return fail('subject_mismatch');
      }

      // Some IdPs put `picture` only in the id_token, not the userinfo response —
      // fall back to it so the avatar (#1399) still populates.
      if (!userInfo.picture && typeof idVerify.claims.picture === 'string') {
        userInfo.picture = idVerify.claims.picture;
      }

      const result = this.oidc.findOrCreateUser(userInfo, config, pending.inviteToken);
      if ('error' in result) return fail(result.error);
      if (result.created) {
        // An account the callback just made is a registration, the way a password
        // signup is (auth-public.controller): the same row, plus the way in. Without
        // it an admin reading user.register for who got an account never sees the
        // SSO ones, and the log looks complete while it is not.
        this.audit.writeAudit({
          userId: result.user.id,
          action: 'user.register',
          ip: getClientIp(req),
          details: { username: result.user.username, email: result.user.email, role: result.user.role, method: 'oidc' },
        });
      }
      if (result.roleChange) {
        // The claim mapping changing someone's privileges is a security event, and
        // the row is written here because this is where the client IP is. The claim
        // NAME goes in the details, never its value: that column is readable by
        // every admin and a claim can carry group memberships and worse.
        this.audit.writeAudit({
          userId: result.user.id,
          action: 'oidc.role_change',
          resource: String(result.user.id),
          ip: getClientIp(req),
          details: { from: result.roleChange.from, to: result.roleChange.to, claim: result.roleChange.claim },
        });
      }

      this.oidc.touchLastLogin(result.user.id);
      this.logger.log(`oidc callback outcome=${result.created ? 'registered' : 'logged_in'} hadInvite=${hadInvite}`);
      // The login row every other method writes (#2417). Here rather than at
      // /exchange, because this is where the provider has vouched for the user
      // and where the client IP is, the same place the role change is recorded;
      // `method` names the way in, as the passkey login does.
      this.audit.writeAudit({ userId: result.user.id, action: 'user.login', ip: getClientIp(req), details: { method: 'oidc' } });
      // Pass the flag through untouched: `undefined` must reach the token as
      // "absent", not `false`, or the sliding renewal would later downgrade the
      // default persistent cookie to a browser-session one (remember-me, #1927).
      const jwtToken = this.oidc.generateToken(result.user, pending.remember);
      const { code: authCode, binding } = this.oidc.createAuthCode(jwtToken, pending.remember);
      // Bind the code to THIS browser, the way the state cookie binds the callback.
      // The code rides home in a URL, so it is readable from history, from a
      // referrer and from anything that logs URLs; without a second half nobody
      // else holds, /exchange would hand a session to whoever presents it — either
      // stealing this login, or (a code the attacker minted for their own account,
      // fed to a victim's browser) fixing the victim into the attacker's session.
      res.cookie(OIDC_EXCHANGE_COOKIE, binding, { ...cookieOptions(false, req), maxAge: OIDC_AUTH_CODE_TTL_MS });
      return f('/login?oidc_code=' + authCode);
    } catch (err: unknown) {
      console.error('[OIDC] Callback error:', err);
      return fail('server_error');
    }
  }

  @Get('exchange')
  exchange(@Query('code') code: string | undefined, @Req() req: Request, @Res() res: Response): void {
    // The binding cookie is single-use like the state cookie: one redemption
    // attempt per callback, whatever its outcome.
    const binding = (req.cookies as Record<string, string> | undefined)?.[OIDC_EXCHANGE_COOKIE];
    res.clearCookie(OIDC_EXCHANGE_COOKIE, cookieOptions(true, req));

    if (!code) {
      this.logger.warn('oidc exchange failed reason=missing_code');
      res.status(400).json({ error: 'Code required' });
      return;
    }
    const result = this.oidc.consumeAuthCode(code, binding);
    if ('error' in result) {
      // 原因分四種，只記原因代碼，不記 code 與 cookie 值。
      const reason = result.error === 'Code expired' ? 'expired' : !binding ? 'missing_binding_cookie' : 'unknown_or_expired_code';
      this.logger.warn(`oidc exchange failed reason=${reason}`);
      res.status(400).json({ error: result.error });
      return;
    }
    this.oidc.setAuthCookie(res, result.token, req, result.remember);
    res.json({ token: result.token });
  }
}

/**
 * /api/admin/oidc — the SSO configuration.
 *
 * Two routes that sat on AdminController with their SQL in AdminService, for a domain
 * that already had a module. They read and write the same five app_settings keys the
 * login flow next door consumes, so they belong here; the lockout guard that refuses
 * to remove the config while password login is off lives with them in OidcService.
 *
 * The path, the {error,status} envelope and the audit action are unchanged.
 */
@Controller('api/admin/oidc')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminOidcController {
  constructor(
    private readonly oidc: OidcService,
    private readonly audit: AuditService,
  ) {}

  // Both halves, not just the write: reading back the issuer, client id and the
  // discovery URL tells a caller how the identity of this install is wired, and
  // on a managed install that wiring is not theirs.
  @ManagedForbidden('the identity provider is part of what the operator runs')
  @Get()
  get() {
    return this.oidc.getOidcSettings();
  }

  @ManagedForbidden('an instance-supplied issuer could assert any address as verified')
  @Put()
  update(@CurrentUser() user: User, @Body() body: AdminOidcUpdateDto, @Req() req: Request) {
    const result = this.oidc.updateOidcSettings(body);
    if (result.error) {
      throw new HttpException({ error: result.error }, result.status || 400);
    }
    // Only whether an issuer was set, never the value: the details column is readable
    // by every admin and the issuer identifies the customer's IdP tenant.
    this.audit.writeAudit({
      userId: user.id,
      action: 'admin.oidc_update',
      ip: getClientIp(req),
      details: { issuer_set: !!body.issuer },
    });
    return { success: true };
  }
}
