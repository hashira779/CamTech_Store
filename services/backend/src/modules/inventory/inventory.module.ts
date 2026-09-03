import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { InventoryService } from './application/inventory.service';
import { InventoryController } from './interface/inventory.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
