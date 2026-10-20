import { Module } from '@nestjs/common';
import { AdminOidcController, OidcController } from './oidc.controller';
import { AuditModule } from '../audit/audit.module';
import { OidcService } from './oidc.service';
import { AuthModule } from '../auth/auth.module';
import { TripMembershipModule } from '../trip-membership/trip-membership.module';
import { INVITE_ENTRY_GATE } from '../platform/invite-entry';

@Module({
  imports: [AuthModule, TripMembershipModule, AuditModule],
  controllers: [OidcController, AdminOidcController],
  // INVITE_ENTRY_GATE：AppModule 的 SpaFallbackFilter 用它決定邀請連結要不要直接送去 LINE 登入。
  providers: [OidcService, { provide: INVITE_ENTRY_GATE, useExisting: OidcService }],
  exports: [INVITE_ENTRY_GATE],
})
export class OidcModule {}
