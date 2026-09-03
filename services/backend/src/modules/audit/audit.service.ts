import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface AuditEntry {
  organizationId?: string | null;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  result?: 'SUCCESS' | 'FAILURE';
}

/**
 * Append-only audit trail (spec §69). Records who/what/when/where.
 *
 * Writing must never break the business operation: failures are logged, not
 * thrown. In a later phase this becomes an event consumer (spec §7) so audit
 * writes happen out-of-band.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: entry.organizationId ?? null,
          actorId: entry.actorId ?? null,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId ?? null,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          ip: entry.ip ?? null,
          result: entry.result ?? 'SUCCESS',
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to write audit log for ${entry.action}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
