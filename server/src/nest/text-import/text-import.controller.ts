import { Body, Controller, HttpCode, HttpException, Param, Post, UseGuards } from '@nestjs/common';
import type { User } from '../../types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermission, TripAccessGuard } from '../permissions/trip-access.guard';
import { RateLimitService } from '../common/rate-limit.service';
import { TextImportRequestDto } from './text-import.dto';
import { LlmDisabledError, TextImportService } from './text-import.service';
import { MAX_TEXT_CHARS, TextTooLongError } from './rules';

export const TEXT_IMPORT_RL_MAX = 10;
export const TEXT_IMPORT_RL_WINDOW_MS = 60 * 60 * 1000;

/**
 * POST /api/trips/:tripId/import-text — 貼上行程文字，回傳結構化的每天每一站（不寫入）。
 * 需登入並有 'day_edit' 權限（TripAccessGuard：沒權限 403、看不到的行程 404）。
 * 每位使用者每小時 10 次。請求內容絕不寫進日誌。
 */
@Controller('api/trips/:tripId/import-text')
@UseGuards(JwtAuthGuard, TripAccessGuard)
export class TextImportController {
  constructor(private readonly svc: TextImportService, private readonly rl: RateLimitService) {}

  @RequirePermission('day_edit')
  @Post()
  @HttpCode(200)
  async importText(@CurrentUser() user: User, @Param('tripId') tripId: string, @Body() body: TextImportRequestDto) {
    // zod 已擋 >8000（400）；這裡再保一道，也處理純空白
    if (body.text.length > MAX_TEXT_CHARS) throw new HttpException({ error: 'Text too long' }, 413);
    if (!body.text.trim()) throw new HttpException({ error: 'Text required' }, 400);
    if (!this.rl.check('text_import', String(user.id), TEXT_IMPORT_RL_MAX, TEXT_IMPORT_RL_WINDOW_MS, Date.now())) {
      throw new HttpException({ error: 'Too many requests. Please try again later.' }, 429);
    }
    try {
      return await this.svc.parse(Number(tripId), body.text, body.useLlm === true);
    } catch (err) {
      if (err instanceof LlmDisabledError) throw new HttpException({ error: 'LLM parsing is not configured' }, 501);
      if (err instanceof TextTooLongError) throw new HttpException({ error: 'Text too long' }, 413);
      throw err;
    }
  }
}
