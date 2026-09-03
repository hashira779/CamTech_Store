import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { SalesService } from './application/sales.service';
import { SalesController } from './interface/sales.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
