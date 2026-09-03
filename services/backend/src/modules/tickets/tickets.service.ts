import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type {
  CreateServiceTicketInput,
  AddTicketCommentInput,
  ServiceTicketDto,
  TicketCommentDto,
  TicketPriority,
  TicketStatus,
} from '@mystore/contracts';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listTickets(
    orgId: string,
    status?: TicketStatus,
    priority?: TicketPriority,
  ): Promise<ServiceTicketDto[]> {
    const tickets = await this.prisma.serviceTicket.findMany({
      where: {
        organizationId: orgId,
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
      },
      include: { comments: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return tickets.map((t) => this.mapTicketDto(t));
  }

  async getTicket(orgId: string, id: string): Promise<ServiceTicketDto> {
    const ticket = await this.prisma.serviceTicket.findFirst({
      where: { id, organizationId: orgId },
      include: { comments: { orderBy: { createdAt: 'asc' } } },
    });
    if (!ticket) {
      throw new NotFoundException(`Service ticket ${id} not found`);
    }
    return this.mapTicketDto(ticket);
  }

  async createTicket(
    orgId: string,
    input: CreateServiceTicketInput,
    reporterId?: string,
  ): Promise<ServiceTicketDto> {
    const count = await this.prisma.serviceTicket.count({
      where: { organizationId: orgId },
    });
    const year = new Date().getFullYear();
    const ticketNumber = `TICK-${year}-${(count + 1).toString().padStart(5, '0')}`;

    const created = await this.prisma.serviceTicket.create({
      data: {
        organizationId: orgId,
        ticketNumber,
        subject: input.subject,
        description: input.description,
        priority: input.priority || 'MEDIUM',
        status: 'OPEN',
        category: input.category || 'GENERAL',
        assignedToId: input.assignedToId,
        reporterId,
        customerId: input.customerId,
      },
      include: { comments: true },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId: reporterId,
      action: 'TICKET_CREATED',
      resourceType: 'ServiceTicket',
      resourceId: created.id,
      metadata: { ticketNumber: created.ticketNumber, priority: created.priority },
    });

    return this.mapTicketDto(created);
  }

  async addComment(
    orgId: string,
    ticketId: string,
    input: AddTicketCommentInput,
    authorId?: string,
    authorName?: string,
  ): Promise<TicketCommentDto> {
    const ticket = await this.prisma.serviceTicket.findFirst({
      where: { id: ticketId, organizationId: orgId },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    const comment = await this.prisma.ticketComment.create({
      data: {
        ticketId,
        authorId,
        authorName: authorName || 'Support Agent',
        comment: input.comment,
        isInternal: input.isInternal || false,
      },
    });

    return {
      id: comment.id,
      ticketId: comment.ticketId,
      authorId: comment.authorId,
      authorName: comment.authorName,
      comment: comment.comment,
      isInternal: comment.isInternal,
      createdAt: comment.createdAt.toISOString(),
    };
  }

  async updateStatus(
    orgId: string,
    ticketId: string,
    status: TicketStatus,
    resolution?: string,
    actorId?: string,
  ): Promise<ServiceTicketDto> {
    const ticket = await this.prisma.serviceTicket.findFirst({
      where: { id: ticketId, organizationId: orgId },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    const isResolved = status === 'RESOLVED' || status === 'CLOSED';

    const updated = await this.prisma.serviceTicket.update({
      where: { id: ticketId },
      data: {
        status,
        resolution: resolution !== undefined ? resolution : ticket.resolution,
        resolvedAt: isResolved ? new Date() : null,
      },
      include: { comments: { orderBy: { createdAt: 'asc' } } },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: `TICKET_STATUS_${status}`,
      resourceType: 'ServiceTicket',
      resourceId: ticketId,
      metadata: { status, resolution },
    });

    return this.mapTicketDto(updated);
  }

  private mapTicketDto(t: any): ServiceTicketDto {
    return {
      id: t.id,
      organizationId: t.organizationId,
      ticketNumber: t.ticketNumber,
      subject: t.subject,
      description: t.description,
      priority: t.priority as TicketPriority,
      status: t.status as TicketStatus,
      category: t.category,
      assignedToId: t.assignedToId,
      reporterId: t.reporterId,
      customerId: t.customerId,
      resolution: t.resolution,
      resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
      comments: (t.comments || []).map((c: any) => ({
        id: c.id,
        ticketId: c.ticketId,
        authorId: c.authorId,
        authorName: c.authorName,
        comment: c.comment,
        isInternal: c.isInternal,
        createdAt: c.createdAt.toISOString(),
      })),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}
