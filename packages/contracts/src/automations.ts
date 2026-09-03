import { z } from 'zod';

export const FLOW_NODE_TYPES = [
  'TRIGGER',
  'ACTION',
  'CONDITION',
  'TRANSFORM',
] as const;
export type FlowNodeType = (typeof FLOW_NODE_TYPES)[number];

export const FLOW_NODE_SUBTYPES = [
  // Triggers
  'manual_trigger',
  'webhook_trigger',
  'event_order_created',
  'event_inventory_low',
  'event_ticket_created',
  // Actions
  'send_telegram',
  'send_notification',
  'create_ticket',
  'http_request',
  // Conditions & Transforms
  'if_condition',
  'json_mapper',
] as const;
export type FlowNodeSubtype = (typeof FLOW_NODE_SUBTYPES)[number];

export const FLOW_EXECUTION_STATUSES = [
  'SUCCESS',
  'FAILED',
  'RUNNING',
] as const;
export type FlowExecutionStatus = (typeof FLOW_EXECUTION_STATUSES)[number];

export interface FlowNode {
  id: string;
  name: string;
  type: FlowNodeType;
  subtype: FlowNodeSubtype;
  parameters: Record<string, any>;
  position: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: 'true' | 'false' | 'default' | null;
}

export const createFlowSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  triggerType: z.string().min(1),
  nodes: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(FLOW_NODE_TYPES),
      subtype: z.enum(FLOW_NODE_SUBTYPES),
      parameters: z.record(z.any()),
      position: z.object({ x: z.number(), y: z.number() }),
    }),
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      sourceNodeId: z.string(),
      targetNodeId: z.string(),
      sourceHandle: z.enum(['true', 'false', 'default']).optional().nullable(),
    }),
  ),
});
export type CreateFlowInput = z.infer<typeof createFlowSchema>;

export const updateFlowSchema = createFlowSchema.partial();
export type UpdateFlowInput = z.infer<typeof updateFlowSchema>;

export const executeFlowSchema = z.object({
  payload: z.record(z.any()).optional().default({}),
});
export type ExecuteFlowInput = z.infer<typeof executeFlowSchema>;

export interface NodeExecutionTraceDto {
  nodeId: string;
  nodeName: string;
  nodeType: FlowNodeType;
  subtype: FlowNodeSubtype;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  inputData: Record<string, any>;
  outputData?: Record<string, any> | null;
  errorMessage?: string | null;
  durationMs: number;
}

export interface FlowExecutionDto {
  id: string;
  organizationId: string;
  flowId: string;
  triggerType: string;
  status: FlowExecutionStatus;
  triggerPayload: Record<string, any>;
  executionTrace: NodeExecutionTraceDto[];
  startedAt: string;
  finishedAt?: string | null;
}

export interface AutomationFlowDto {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  triggerType: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  lastExecution?: FlowExecutionDto | null;
  createdAt: string;
  updatedAt: string;
}
