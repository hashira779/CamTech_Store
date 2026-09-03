import { Module } from '@nestjs/common';
import { OpsController } from './ops.controller';
import { MetricsService } from './metrics.service';

@Module({
  controllers: [OpsController],
  providers: [MetricsService],
})
export class OpsModule {}
