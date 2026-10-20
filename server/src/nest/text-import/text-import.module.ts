import { Module } from '@nestjs/common';
import { TextImportController } from './text-import.controller';
import { TextImportService } from './text-import.service';
import { PermissionsModule } from '../permissions/permissions.module';
import { RateLimitModule } from '../common/rate-limit.module';
import { AppConfigModule } from '../app-config/app-config.module';
import { AuthModule } from '../auth/auth.module';

/** 台灣在地化：貼上 LINE 行程文字自動拆成每天站點（規則優先、LLM 後備）。 */
@Module({
  imports: [PermissionsModule, RateLimitModule, AppConfigModule, AuthModule],
  controllers: [TextImportController],
  providers: [TextImportService],
})
export class TextImportModule {}
