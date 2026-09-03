import {
  Controller,
  Get,
  Header,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MetricsService } from './metrics.service';
import { Public } from '../../common/auth/public.decorator';
import { SkipEnvelope } from '../../common/http/skip-envelope.decorator';

/**
 * Liveness, readiness and metrics endpoints (spec §70, §71).
 * Unversioned, public, and exempt from rate limiting so orchestrators
 * (k8s probes, Prometheus scrape) can always reach them.
 */
@ApiTags('ops')
@Controller({ version: VERSION_NEUTRAL })
@Public()
@SkipThrottle()
export class OpsController {
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  /** Liveness: is the process up at all. */
  @Get('health')
  health(): { status: string; uptimeSeconds: number } {
    return { status: 'ok', uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000) };
  }

  /** Readiness: are dependencies (the database) reachable. */
  @Get('ready')
  async ready(): Promise<{ status: string; db: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', db: 'up' };
    } catch {
      throw new ServiceUnavailableException({ code: 'NOT_READY', message: 'Database unreachable' });
    }
  }

  /** Prometheus scrape target — raw text, not the JSON envelope. */
  @Get('metrics')
  @SkipEnvelope()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  metricsEndpoint(): Promise<string> {
    return this.metrics.metrics();
  }
}
