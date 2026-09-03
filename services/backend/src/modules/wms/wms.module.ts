import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { WmsService } from './wms.service';
import { WmsController } from './wms.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [WmsController],
  providers: [WmsService],
  exports: [WmsService],
})
export class WmsModule {}
