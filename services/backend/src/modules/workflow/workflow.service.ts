import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WorkflowStateMachine } from './domain/workflow-state-machine';
import type {
  SubmitApprovalInput,
  ReviewWorkflowStepInput,
  WorkflowInstanceDto,
  WorkflowStatus,
  WorkflowEntityType,
  WorkflowStepStatus,
} from '@mystore/contracts';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async submitApproval(
    orgId: string,
    input: SubmitApprovalInput,
    userId?: string,
  ): Promise<WorkflowInstanceDto> {
    const stepsData = input.steps && input.steps.length > 0
      ? input.steps
      : [
          { stepOrder: 1, name: 'Manager Review', assignedRole: 'BRANCH_MANAGER' },
          { stepOrder: 2, name: 'Executive Approval', assignedRole: 'SUPER_ADMIN' },
        ];

    const created = await this.prisma.$transaction(async (tx) => {
      const instance = await tx.workflowInstance.create({
        data: {
          organizationId: orgId,
          entityType: input.entityType,
          entityId: input.entityId,
          title: input.title,
          definitionId: input.definitionId,
          status: 'PENDING',
          submittedById: userId,
          currentStep: 1,
          totalSteps: stepsData.length,
          metadata: input.metadata ? (input.metadata as any) : undefined,
        },
      });

      for (const s of stepsData) {
        await tx.workflowStep.create({
          data: {
            instanceId: instance.id,
            stepOrder: s.stepOrder,
            name: s.name,
            assignedRole: s.assignedRole,
            assignedToId: s.assignedToId,
            status: 'PENDING',
          },
        });
      }

      await tx.workflowLog.create({
        data: {
          instanceId: instance.id,
          actorId: userId,
          action: 'SUBMITTED',
          comment: `Approval request submitted for ${input.entityType} #${input.entityId}`,
        },
      });

      return tx.workflowInstance.findUniqueOrThrow({
        where: { id: instance.id },
        include: { steps: { orderBy: { stepOrder: 'asc' } }, logs: { orderBy: { createdAt: 'desc' } } },
      });
    });

    await this.audit.record({
      organizationId: orgId,
      actorId: userId,
      action: 'WORKFLOW_SUBMITTED',
      resourceType: 'WorkflowInstance',
      resourceId: created.id,
      metadata: { entityType: created.entityType, entityId: created.entityId },
    });

    return this.mapInstanceDto(created);
  }

  async listInstances(
    orgId: string,
    status?: WorkflowStatus,
  ): Promise<WorkflowInstanceDto[]> {
    const instances = await this.prisma.workflowInstance.findMany({
      where: {
        organizationId: orgId,
        ...(status ? { status } : {}),
      },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        logs: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return instances.map((i) => this.mapInstanceDto(i));
  }

  async getInstance(orgId: string, id: string): Promise<WorkflowInstanceDto> {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { id, organizationId: orgId },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        logs: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!instance) {
      throw new NotFoundException(`Workflow instance ${id} not found`);
    }

    return this.mapInstanceDto(instance);
  }

  async reviewStep(
    orgId: string,
    instanceId: string,
    stepId: string,
    input: ReviewWorkflowStepInput,
    userId?: string,
  ): Promise<WorkflowInstanceDto> {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { id: instanceId, organizationId: orgId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!instance) {
      throw new NotFoundException(`Workflow instance ${instanceId} not found`);
    }

    let decisionResult;
    try {
      decisionResult = WorkflowStateMachine.applyDecision(
        {
          id: instance.id,
          status: instance.status as WorkflowStatus,
          currentStep: instance.currentStep,
          totalSteps: instance.totalSteps,
          steps: instance.steps.map((s) => ({
            id: s.id,
            stepOrder: s.stepOrder,
            name: s.name,
            status: s.status as WorkflowStepStatus,
            decisionBy: s.decisionBy,
            decisionAt: s.decisionAt,
            comment: s.comment,
          })),
        },
        stepId,
        input.action,
        userId || 'system',
        input.comment,
      );
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Update target step
      const targetStep = decisionResult.updatedSteps.find((s) => s.id === stepId)!;
      await tx.workflowStep.update({
        where: { id: stepId },
        data: {
          status: targetStep.status,
          decisionBy: targetStep.decisionBy,
          decisionAt: targetStep.decisionAt,
          comment: targetStep.comment,
        },
      });

      // Update instance status & current step
      const inst = await tx.workflowInstance.update({
        where: { id: instanceId },
        data: {
          status: decisionResult.instanceStatus,
          currentStep: decisionResult.currentStep,
        },
      });

      // Log decision
      await tx.workflowLog.create({
        data: {
          instanceId,
          actorId: userId,
          action: input.action,
          comment: input.comment || `Step ${stepId} ${input.action.toLowerCase()}ed`,
        },
      });

      return tx.workflowInstance.findUniqueOrThrow({
        where: { id: inst.id },
        include: { steps: { orderBy: { stepOrder: 'asc' } }, logs: { orderBy: { createdAt: 'desc' } } },
      });
    });

    await this.audit.record({
      organizationId: orgId,
      actorId: userId,
      action: `WORKFLOW_STEP_${input.action}`,
      resourceType: 'WorkflowStep',
      resourceId: stepId,
      metadata: { instanceId, action: input.action },
    });

    return this.mapInstanceDto(updated);
  }

  private mapInstanceDto(i: any): WorkflowInstanceDto {
    return {
      id: i.id,
      organizationId: i.organizationId,
      definitionId: i.definitionId,
      entityType: i.entityType as WorkflowEntityType,
      entityId: i.entityId,
      title: i.title,
      status: i.status as WorkflowStatus,
      submittedById: i.submittedById,
      currentStep: i.currentStep,
      totalSteps: i.totalSteps,
      metadata: i.metadata,
      steps: (i.steps || []).map((s: any) => ({
        id: s.id,
        instanceId: s.instanceId,
        stepOrder: s.stepOrder,
        name: s.name,
        assignedRole: s.assignedRole,
        assignedToId: s.assignedToId,
        status: s.status as WorkflowStepStatus,
        decisionBy: s.decisionBy,
        decisionAt: s.decisionAt ? s.decisionAt.toISOString() : null,
        comment: s.comment,
      })),
      logs: (i.logs || []).map((l: any) => ({
        id: l.id,
        instanceId: l.instanceId,
        actorId: l.actorId,
        action: l.action,
        comment: l.comment,
        createdAt: l.createdAt.toISOString(),
      })),
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    };
  }
}
