import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Single Prisma connection for the modular monolith (spec §4).
 *
 * Repositories depend on this; controllers/services never touch it directly.
 * When a module is later extracted into its own service (spec §75), it takes
 * its tables and its own PrismaService with it.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Prisma');

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
