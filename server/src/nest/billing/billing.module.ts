import { Module } from '@nestjs/common';
import { RateLimitModule } from '../common/rate-limit.module';
import { TripsModule } from '../trips/trips.module';
import { TripInviteModule } from '../trip-invite/trip-invite.module';
import { MailerModule } from '../notifications/mailer/mailer.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

/** ENSCON 旅程按趟收費（Recur 單次付款 → 自動開團）。 */
@Module({
  imports: [RateLimitModule, TripsModule, TripInviteModule, MailerModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
