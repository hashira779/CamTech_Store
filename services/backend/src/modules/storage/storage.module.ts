import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { STORAGE_DRIVER } from './domain/storage-driver.interface';
import { LocalStorageDriver } from './infrastructure/local-storage.driver';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [StorageController],
  providers: [
    StorageService,
    LocalStorageDriver,
    {
      provide: STORAGE_DRIVER,
      useExisting: LocalStorageDriver,
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
