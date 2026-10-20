import { Body, Controller, HttpCode, HttpException, Param, Post, UseGuards } from '@nestjs/common';
import type { User } from '../../types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermission, TripAccessGuard } from '../permissions/trip-access.guard';
import { RateLimitService } from '../common/rate-limit.service';
import { TextImportRequestDto } from './text-import.dto';
import { LlmDisabledError, LlmRateLimitedError, TextImportService } from './text-import.service';
import { MAX_TEXT_CHARS, TextTooLongError } from './rules';

/** 真的呼叫 AI（花錢的那一步）每人每小時 10 次。 */
export const TEXT_IMPORT_LLM_RL_MAX = 10;
/** 每一次解析請求（含只跑規則的）每人每小時 120 次，只為防濫用。 */
export const TEXT_IMPORT_RULES_RL_MAX = 120;
export const TEXT_IMPORT_RL_WINDOW_MS = 60 * 60 * 1000;

/**
 * POST /api/trips/:tripId/import-text — 貼上行程文字，回傳結構化的每天每一站（不寫入）。
 * 需登入並有 'day_edit' 權限（TripAccessGuard：沒權限 403、看不到的行程 404）。
 * 速率限制分兩層：每次請求算進 120 次／小時（防濫用）；真的呼叫 AI 才算進 10 次／小時。
 * AI 額度用完時：使用者按「讓 AI 再解析」回 429；規則不足自動走 AI 的情況改回規則結果、不報錯。
 * 請求內容絕不寫進日誌。
 */
@Controller('api/trips/:tripId/import-text')
@UseGuards(JwtAuthGuard, TripAccessGuard)
export class TextImportController {
  constructor(private readonly svc: TextImportService, private readonly rl: RateLimitService) {}

  @RequirePermission('day_edit')
  @Post()
  @HttpCode(200)
  async importText(@CurrentUser() user: User, @Param('tripId') tripId: string, @Body() body: TextImportRequestDto) {
    // zod 已擋 >MAX_TEXT_CHARS（400）；這裡再保一道，也處理純空白
    if (body.text.length > MAX_TEXT_CHARS) throw new HttpException({ error: 'Text too long' }, 413);
    if (!body.text.trim()) throw new HttpException({ error: 'Text required' }, 400);
    const uid = String(user.id);
    if (!this.rl.check('text_import', uid, TEXT_IMPORT_RULES_RL_MAX, TEXT_IMPORT_RL_WINDOW_MS, Date.now())) {
      throw new HttpException({ error: 'Too many requests. Please try again later.' }, 429);
    }
    // 只在服務真的要呼叫 AI 時才扣 AI 額度（規則夠用、沒金鑰都不扣）
    const takeLlmQuota = () => this.rl.check('text_import_llm', uid, TEXT_IMPORT_LLM_RL_MAX, TEXT_IMPORT_RL_WINDOW_MS, Date.now());
    try {
      return await this.svc.parse(Number(tripId), body.text, body.useLlm === true, takeLlmQuota);
    } catch (err) {
      if (err instanceof LlmDisabledError) throw new HttpException({ error: 'LLM parsing is not configured' }, 501);
      if (err instanceof LlmRateLimitedError) throw new HttpException({ error: 'Too many requests. Please try again later.' }, 429);
      if (err instanceof TextTooLongError) throw new HttpException({ error: 'Text too long' }, 413);
      throw err;
    }
  }
}
