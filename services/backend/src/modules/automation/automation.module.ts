import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';

@Module({
  imports: [PrismaModule, AuditModule, TelegramModule],
  controllers: [AutomationController],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
