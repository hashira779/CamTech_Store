import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { CHANNEL_ADAPTERS } from './domain/channel-adapter.interface';
import { TelegramAdapter } from './infrastructure/telegram.adapter';
import { InAppAdapter } from './infrastructure/in-app.adapter';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    TelegramAdapter,
    InAppAdapter,
    {
      provide: CHANNEL_ADAPTERS,
      useFactory: (telegram: TelegramAdapter, inApp: InAppAdapter) => [telegram, inApp],
      inject: [TelegramAdapter, InAppAdapter],
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
