import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { DeveloperService } from './developer.service';
import { DeveloperController } from './developer.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [DeveloperController],
  providers: [DeveloperService],
  exports: [DeveloperService],
})
export class DeveloperModule {}
