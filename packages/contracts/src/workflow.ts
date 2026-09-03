import { z } from 'zod';

export const WORKFLOW_ENTITY_TYPES = [
  'PURCHASE_ORDER',
  'SALE_REFUND',
  'STOCK_TRANSFER',
  'JOURNAL_ENTRY',
  'EXPENSE_CLAIM',
  'CUSTOM',
] as const;
export type WorkflowEntityType = (typeof WORKFLOW_ENTITY_TYPES)[number];

export const WORKFLOW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const WORKFLOW_STEP_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SKIPPED'] as const;
export type WorkflowStepStatus = (typeof WORKFLOW_STEP_STATUSES)[number];

// ─── Schemas ─────────────────────────────────────────────────────

export const createWorkflowStepInputSchema = z.object({
  stepOrder: z.number().int().min(1),
  name: z.string().min(1).max(100),
  assignedRole: z.string().optional(),
  assignedToId: z.string().optional(),
});
export type CreateWorkflowStepInput = z.infer<typeof createWorkflowStepInputSchema>;

export const createWorkflowDefinitionSchema = z.object({
  name: z.string().min(1).max(100),
  entityType: z.enum(WORKFLOW_ENTITY_TYPES),
  description: z.string().optional(),
  steps: z.array(createWorkflowStepInputSchema).min(1),
});
export type CreateWorkflowDefinitionInput = z.infer<typeof createWorkflowDefinitionSchema>;

export const submitApprovalInputSchema = z.object({
  entityType: z.enum(WORKFLOW_ENTITY_TYPES),
  entityId: z.string().min(1),
  title: z.string().min(1).max(200),
  definitionId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  steps: z.array(createWorkflowStepInputSchema).optional(),
});
export type SubmitApprovalInput = z.infer<typeof submitApprovalInputSchema>;

export const reviewWorkflowStepSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  comment: z.string().max(500).optional(),
});
export type ReviewWorkflowStepInput = z.infer<typeof reviewWorkflowStepSchema>;

// ─── DTOs ────────────────────────────────────────────────────────

export interface WorkflowStepDto {
  id: string;
  instanceId: string;
  stepOrder: number;
  name: string;
  assignedRole?: string | null;
  assignedToId?: string | null;
  status: WorkflowStepStatus;
  decisionBy?: string | null;
  decisionAt?: string | null;
  comment?: string | null;
}

export interface WorkflowLogDto {
  id: string;
  instanceId: string;
  actorId?: string | null;
  action: string;
  comment?: string | null;
  createdAt: string;
}

export interface WorkflowInstanceDto {
  id: string;
  organizationId: string;
  definitionId?: string | null;
  entityType: WorkflowEntityType;
  entityId: string;
  title: string;
  status: WorkflowStatus;
  submittedById?: string | null;
  currentStep: number;
  totalSteps: number;
  metadata?: Record<string, unknown> | null;
  steps: WorkflowStepDto[];
  logs: WorkflowLogDto[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDefinitionDto {
  id: string;
  organizationId: string;
  name: string;
  entityType: WorkflowEntityType;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
