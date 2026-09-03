import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [LoyaltyController],
  providers: [LoyaltyService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
