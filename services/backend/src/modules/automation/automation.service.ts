import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TelegramService } from '../telegram/telegram.service';
import {
  FlowExecutionEngine,
  type FlowActionDispatcher,
} from './domain/flow-execution.engine';
import type {
  CreateFlowInput,
  UpdateFlowInput,
  AutomationFlowDto,
  FlowExecutionDto,
  FlowNode,
  FlowEdge,
  FlowNodeSubtype,
  NodeExecutionTraceDto,
  FlowExecutionStatus,
} from '@mystore/contracts';

@Injectable()
export class AutomationService implements FlowActionDispatcher {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly telegramService: TelegramService,
  ) {}

  // ─── Flow Definition Management ─────────────────────────────────

  async listFlows(orgId: string): Promise<AutomationFlowDto[]> {
    const flows = await this.prisma.automationFlow.findMany({
      where: { organizationId: orgId },
      include: {
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return flows.map((f) => this.mapFlowToDto(f));
  }

  async getFlow(orgId: string, id: string): Promise<AutomationFlowDto> {
    const flow = await this.prisma.automationFlow.findFirst({
      where: { id, organizationId: orgId },
      include: {
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!flow) {
      throw new NotFoundException(`Flow ${id} not found`);
    }

    return this.mapFlowToDto(flow);
  }

  async createFlow(orgId: string, input: CreateFlowInput): Promise<AutomationFlowDto> {
    const created = await this.prisma.automationFlow.create({
      data: {
        organizationId: orgId,
        name: input.name,
        description: input.description,
        isActive: input.isActive ?? true,
        triggerType: input.triggerType,
        nodes: input.nodes as any,
        edges: input.edges as any,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      action: 'FLOW_CREATED',
      resourceType: 'AutomationFlow',
      resourceId: created.id,
      metadata: { name: created.name, triggerType: created.triggerType },
    });

    return this.mapFlowToDto(created);
  }

  async updateFlow(orgId: string, id: string, input: UpdateFlowInput): Promise<AutomationFlowDto> {
    const existing = await this.prisma.automationFlow.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) {
      throw new NotFoundException(`Flow ${id} not found`);
    }

    const updated = await this.prisma.automationFlow.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.triggerType ? { triggerType: input.triggerType } : {}),
        ...(input.nodes ? { nodes: input.nodes as any } : {}),
        ...(input.edges ? { edges: input.edges as any } : {}),
      },
      include: {
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });

    await this.audit.record({
      organizationId: orgId,
      action: 'FLOW_UPDATED',
      resourceType: 'AutomationFlow',
      resourceId: id,
      metadata: { name: updated.name },
    });

    return this.mapFlowToDto(updated);
  }

  async deleteFlow(orgId: string, id: string): Promise<{ success: boolean }> {
    const existing = await this.prisma.automationFlow.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) {
      throw new NotFoundException(`Flow ${id} not found`);
    }

    await this.prisma.automationFlow.delete({ where: { id } });

    await this.audit.record({
      organizationId: orgId,
      action: 'FLOW_DELETED',
      resourceType: 'AutomationFlow',
      resourceId: id,
      metadata: { name: existing.name },
    });

    return { success: true };
  }

  // ─── Flow Execution Engine ──────────────────────────────────────

  async executeFlow(
    orgId: string,
    flowId: string,
    payload: Record<string, any> = {},
    triggerType = 'MANUAL',
  ): Promise<FlowExecutionDto> {
    const flow = await this.prisma.automationFlow.findFirst({
      where: { id: flowId, organizationId: orgId },
    });
    if (!flow) {
      throw new NotFoundException(`Flow ${flowId} not found`);
    }

    if (!flow.isActive && triggerType !== 'MANUAL') {
      throw new BadRequestException(`Flow '${flow.name}' is currently disabled`);
    }

    const nodes = flow.nodes as unknown as FlowNode[];
    const edges = flow.edges as unknown as FlowEdge[];

    const startedAt = new Date();

    // Execute flow graph using domain engine
    const result = await FlowExecutionEngine.execute(nodes, edges, payload, {
      dispatchAction: (subtype, params, ctx) => this.dispatchActionWithContext(orgId, subtype, params, ctx),
    });

    const finishedAt = new Date();

    const execution = await this.prisma.flowExecution.create({
      data: {
        organizationId: orgId,
        flowId: flow.id,
        triggerType,
        status: result.status,
        triggerPayload: payload,
        executionTrace: result.executionTrace as any,
        startedAt,
        finishedAt,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      action: 'FLOW_EXECUTED',
      resourceType: 'FlowExecution',
      resourceId: execution.id,
      metadata: {
        flowId: flow.id,
        status: result.status,
        stepsExecuted: result.executionTrace.length,
      },
    });

    return this.mapExecutionToDto(execution);
  }

  async listExecutions(orgId: string, flowId?: string): Promise<FlowExecutionDto[]> {
    const executions = await this.prisma.flowExecution.findMany({
      where: {
        organizationId: orgId,
        ...(flowId ? { flowId } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    return executions.map((e) => this.mapExecutionToDto(e));
  }

  // ─── Action Dispatcher Implementation ───────────────────────────

  async dispatchAction(
    subtype: FlowNodeSubtype,
    parameters: Record<string, any>,
    context: Record<string, any>,
  ): Promise<Record<string, any>> {
    return this.dispatchActionWithContext('system', subtype, parameters, context);
  }

  private async dispatchActionWithContext(
    orgId: string,
    subtype: FlowNodeSubtype,
    params: Record<string, any>,
    context: Record<string, any>,
  ): Promise<Record<string, any>> {
    switch (subtype) {
      case 'send_telegram':
        const message = params.text || params.message || 'Automation flow triggered';
        const res = await this.telegramService.sendBroadcast(orgId, String(message));
        return { deliveredToTelegram: true, sentCount: res.sentCount };

      case 'create_ticket':
        const ticket = await this.prisma.serviceTicket.create({
          data: {
            organizationId: orgId,
            ticketNumber: `AUTO-${Date.now().toString().slice(-6)}`,
            subject: params.subject || params.title || 'Automated Service Ticket',
            description: params.description || `Generated by automation flow with payload: ${JSON.stringify(params)}`,
            priority: (params.priority as any) || 'HIGH',
            status: 'OPEN',
          },
        });
        return { ticketCreated: true, ticketId: ticket.id, ticketNumber: ticket.ticketNumber };

      case 'http_request':
        if (!params.url) {
          throw new Error('HTTP Request node requires a valid URL');
        }
        if (!this.isSafeOutboundUrl(params.url)) {
          throw new Error(`Outbound HTTP request to '${params.url}' was blocked by security policy (SSRF protection)`);
        }
        try {
          const method = params.method || 'POST';
          const resp = await fetch(params.url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: method !== 'GET' ? JSON.stringify(params.body || context.$json || {}) : undefined,
            signal: AbortSignal.timeout(5000),
          });
          const text = await resp.text();
          return { statusCode: resp.status, responseText: text.substring(0, 500) };
        } catch (err: any) {
          return { error: err.message, failed: true };
        }

      case 'send_notification':
        const notification = await this.prisma.notificationRecord.create({
          data: {
            organizationId: orgId,
            channel: 'IN_APP',
            type: 'SYSTEM',
            title: params.subject || params.title || 'Automated Alert',
            message: params.content || params.message || JSON.stringify(context.$json),
            status: 'SENT',
            sentAt: new Date(),
          },
        });
        return { notificationId: notification.id, status: 'SENT' };

      default:
        return { executed: true, params };
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private mapFlowToDto(flow: any): AutomationFlowDto {
    const lastExecution = flow.executions?.[0]
      ? this.mapExecutionToDto(flow.executions[0])
      : null;

    return {
      id: flow.id,
      organizationId: flow.organizationId,
      name: flow.name,
      description: flow.description,
      isActive: flow.isActive,
      triggerType: flow.triggerType,
      nodes: (flow.nodes as FlowNode[]) || [],
      edges: (flow.edges as FlowEdge[]) || [],
      lastExecution,
      createdAt: flow.createdAt.toISOString(),
      updatedAt: flow.updatedAt.toISOString(),
    };
  }

  private mapExecutionToDto(e: any): FlowExecutionDto {
    return {
      id: e.id,
      organizationId: e.organizationId,
      flowId: e.flowId,
      triggerType: e.triggerType,
      status: e.status as FlowExecutionStatus,
      triggerPayload: e.triggerPayload as Record<string, any>,
      executionTrace: (e.executionTrace as NodeExecutionTraceDto[]) || [],
      startedAt: e.startedAt.toISOString(),
      finishedAt: e.finishedAt ? e.finishedAt.toISOString() : null,
    };
  }

  /**
   * Enterprise SSRF protection: rejects local loopback, cloud metadata addresses, and private RFC1918 subnets.
   */
  private isSafeOutboundUrl(urlStr: string): boolean {
    try {
      const parsed = new URL(urlStr);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }
      const host = parsed.hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '0.0.0.0' ||
        host === '::1' ||
        host.startsWith('127.') ||
        host === '169.254.169.254' ||
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}

