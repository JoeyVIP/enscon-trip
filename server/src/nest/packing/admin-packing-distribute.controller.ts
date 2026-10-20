import { Body, Controller, HttpCode, HttpException, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PackingService } from './packing.service';
import { PackingDistributeDto } from './packing.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { getClientIp } from '../audit/client-ip';
import { AuditService } from '../audit/audit.service';
import type { User } from '../../types';

/**
 * POST /api/admin/trips/:tripId/packing/distribute — the ENSCON hand-out: an
 * admin gives every trip member (owner included) their own Personal copy of a
 * list, so each person ticks their own and nobody sees anyone else's.
 *
 * Admin-gated like the template CRUD next door (JwtAuthGuard + AdminGuard), not
 * trip-scoped: a trip member, even the trip owner, cannot write into other
 * members' Personal lists, so this cannot sit behind TripAccessGuard +
 * packing_edit. Re-running is safe — see PackingService.distributePersonalItems.
 *
 * The response carries per-member counts keyed by user id only — no item names,
 * no usernames. Each created row is pushed to its owner's sockets alone.
 */
@Controller('api/admin/trips')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminPackingDistributeController {
  constructor(
    private readonly packing: PackingService,
    private readonly audit: AuditService,
  ) {}

  @Post(':tripId/packing/distribute')
  @HttpCode(200)
  distribute(@CurrentUser() user: User, @Param('tripId') tripId: string, @Body() body: PackingDistributeDto, @Req() req: Request) {
    const result = this.packing.distributePersonalItems(tripId, body.items);
    if (!result) throw new HttpException({ error: 'Trip not found' }, 404);

    for (const item of result.items) {
      this.packing.broadcastItem(tripId, 'packing:created', { item }, item, undefined);
    }
    this.audit.writeAudit({
      userId: user.id,
      action: 'admin.packing_distribute',
      resource: String(tripId),
      ip: getClientIp(req),
      details: { items: body.items.length, members: result.members.length, created: result.created, skipped: result.skipped },
    });
    return { members: result.members, created: result.created, skipped: result.skipped };
  }
}
