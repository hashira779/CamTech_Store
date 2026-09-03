import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { CustomersService } from './application/customers.service';
import { CustomersController } from './interface/customers.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
