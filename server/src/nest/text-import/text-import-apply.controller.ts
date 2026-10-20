import { Body, Controller, Headers, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { User } from '../../types';
import type { TripAccess } from '../database/database.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermission, TripAccessGuard } from '../permissions/trip-access.guard';
import { Trip } from '../permissions/trip.decorator';
import { TextImportApplyDto } from './text-import.dto';
import { TextImportApplyService } from './text-import-apply.service';

/**
 * POST /api/trips/:tripId/import-text/apply — 把預覽確認過的站點一次加入行程。
 * 權限同 import-text（登入 + TripAccessGuard 'day_edit'：沒權限 403、看不到的行程 404），
 * 建 place 另驗 'place_edit'。一個 DB transaction：全成功或全不建（失敗回 500，行程不變）。
 */
@Controller('api/trips/:tripId/import-text/apply')
@UseGuards(JwtAuthGuard, TripAccessGuard)
export class TextImportApplyController {
  constructor(private readonly svc: TextImportApplyService) {}

  @RequirePermission('day_edit')
  @Post()
  @HttpCode(200)
  apply(
    @CurrentUser() user: User,
    @Trip() trip: TripAccess,
    @Param('tripId') tripId: string,
    @Body() body: TextImportApplyDto,
    @Headers('x-socket-id') socketId?: string,
  ) {
    return this.svc.apply(trip, user, tripId, body.stops, socketId);
  }
}
