import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { TaxesService } from './taxes.service';
import { TaxesController } from './taxes.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [TaxesController],
  providers: [TaxesService],
  exports: [TaxesService],
})
export class TaxesModule {}
