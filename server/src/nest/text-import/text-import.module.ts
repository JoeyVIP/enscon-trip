import { Module } from '@nestjs/common';
import { TextImportController } from './text-import.controller';
import { TextImportService } from './text-import.service';
import { TextImportApplyController } from './text-import-apply.controller';
import { TextImportApplyService } from './text-import-apply.service';
import { PermissionsModule } from '../permissions/permissions.module';
import { RateLimitModule } from '../common/rate-limit.module';
import { AppConfigModule } from '../app-config/app-config.module';
import { AuthModule } from '../auth/auth.module';
import { PlacesModule } from '../places/places.module';
import { AssignmentsDomainModule } from '../assignments/assignments-domain.module';

/**
 * 台灣在地化：貼上 LINE 行程文字自動拆成每天站點（規則優先、LLM 後備），
 * 以及一次 transaction 加入行程（PlacesModule / AssignmentsDomainModule 同 RoadtripModule 的用法）。
 */
@Module({
  imports: [PermissionsModule, RateLimitModule, AppConfigModule, AuthModule, PlacesModule, AssignmentsDomainModule],
  controllers: [TextImportController, TextImportApplyController],
  providers: [TextImportService, TextImportApplyService],
})
export class TextImportModule {}
