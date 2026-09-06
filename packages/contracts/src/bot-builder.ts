import { z } from 'zod';

// ─── Bot Workflow Status ────────────────────────────────────────────────────

export const BOT_WORKFLOW_STATUSES = ['DRAFT', 'PUBLISHED', 'PAUSED'] as const;
export type BotWorkflowStatus = (typeof BOT_WORKFLOW_STATUSES)[number];

// ─── Node Types ─────────────────────────────────────────────────────────────

export const BOT_NODE_TYPES = [
  // Triggers
  'start', 'command_received', 'message_received', 'callback_query', 'webhook_received',
  // Telegram
  'send_message', 'edit_message', 'delete_message',
  'show_inline_keyboard', 'show_reply_keyboard', 'remove_keyboard',
  'answer_callback', 'send_photo', 'send_document', 'send_location',
  // Input
  'wait_input', 'wait_choice',
  // Logic
  'condition', 'switch', 'delay',
  // Data
  'set_variable', 'api_call',
] as const;
export type BotNodeType = (typeof BOT_NODE_TYPES)[number];

// ─── Node Configuration Types ───────────────────────────────────────────────

export interface BotNodePosition {
  x: number;
  y: number;
}

export interface BotNodeData {
  label: string;
  config: Record<string, any>;
}

export interface BotNode {
  id: string;
  type: BotNodeType;
  position: BotNodePosition;
  data: BotNodeData;
}

export interface BotEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
}

// ─── Workflow DTOs ──────────────────────────────────────────────────────────

export interface BotWorkflowDto {
  id: string;
  organizationId: string;
  botId: string;
  name: string;
  description?: string | null;
  status: BotWorkflowStatus;
  draftNodes: BotNode[];
  draftEdges: BotEdge[];
  draftVariables: Record<string, any>[];
  publishedVersionId?: string | null;
  publishedVersionNumber: number;
  createdBy?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CreateBotWorkflowInput {
  name: string;
  description?: string;
  draftNodes?: BotNode[];
  draftEdges?: BotEdge[];
  draftVariables?: Record<string, any>[];
}

export interface UpdateBotWorkflowInput {
  name?: string;
  description?: string;
  status?: BotWorkflowStatus;
  draftNodes?: BotNode[];
  draftEdges?: BotEdge[];
  draftVariables?: Record<string, any>[];
}

export interface PublishWorkflowInput {
  notes?: string;
}

// ─── Version DTOs ───────────────────────────────────────────────────────────

export interface BotWorkflowVersionDto {
  id: string;
  organizationId: string;
  workflowId: string;
  versionNumber: number;
  nodes: BotNode[];
  edges: BotEdge[];
  variables: Record<string, any>[];
  commands: Record<string, any>[];
  publishedBy?: string | null;
  publishedAt: string;
  notes?: string | null;
}

// ─── Command DTOs ───────────────────────────────────────────────────────────

export interface BotCommandDto {
  id: string;
  organizationId: string;
  botId: string;
  command: string;
  description?: string | null;
  workflowId?: string | null;
  scope: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CreateBotCommandInput {
  command: string;
  description?: string;
  workflowId?: string;
  scope?: string;
  isActive?: boolean;
}

export interface UpdateBotCommandInput {
  command?: string;
  description?: string;
  workflowId?: string;
  scope?: string;
  isActive?: boolean;
}

// ─── Execution DTOs ─────────────────────────────────────────────────────────

export interface BotExecutionTraceItemDto {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  inputData?: Record<string, any> | null;
  outputData?: Record<string, any> | null;
  errorMessage?: string | null;
  durationMs: number;
}

export interface BotExecutionDto {
  id: string;
  organizationId: string;
  botId: string;
  workflowId?: string | null;
  workflowVersionId?: string | null;
  versionNumber?: number | null;
  telegramUserId?: string | null;
  chatId?: string | null;
  triggerType: string;
  triggerData?: Record<string, any> | null;
  executionTrace: BotExecutionTraceItemDto[];
  status: string;
  errorMessage?: string | null;
  startedAt: string;
  finishedAt?: string | null;
}

// ─── Analytics ──────────────────────────────────────────────────────────────

export interface BotAnalyticsDto {
  totalExecutions: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  uniqueUsers: number;
}

// ─── Webhook Registration ───────────────────────────────────────────────────

export interface RegisterWebhookInput {
  webhookUrl: string;
  secretToken?: string;
}

// ─── Node Category Definitions (for the UI node library) ────────────────────

export interface NodeCategoryItem {
  type: BotNodeType;
  label: string;
  icon: string;
  description: string;
  category: string;
}

export const NODE_LIBRARY: NodeCategoryItem[] = [
  // Triggers
  { type: 'start', label: 'Bot Started', icon: '🚀', description: 'Entry point when bot starts', category: 'Triggers' },
  { type: 'command_received', label: 'Command Received', icon: '⌘', description: 'Triggered by a /command', category: 'Triggers' },
  { type: 'message_received', label: 'Message Received', icon: '💬', description: 'Triggered by any text message', category: 'Triggers' },
  { type: 'callback_query', label: 'Button Clicked', icon: '👆', description: 'Triggered by inline button click', category: 'Triggers' },
  // Telegram
  { type: 'send_message', label: 'Send Message', icon: '📤', description: 'Send a text message', category: 'Telegram' },
  { type: 'show_inline_keyboard', label: 'Inline Keyboard', icon: '⌨️', description: 'Show inline buttons', category: 'Telegram' },
  { type: 'show_reply_keyboard', label: 'Reply Keyboard', icon: '🎹', description: 'Show reply keyboard', category: 'Telegram' },
  { type: 'remove_keyboard', label: 'Remove Keyboard', icon: '🚫', description: 'Remove reply keyboard', category: 'Telegram' },
  { type: 'send_photo', label: 'Send Photo', icon: '📸', description: 'Send an image', category: 'Telegram' },
  { type: 'send_document', label: 'Send Document', icon: '📄', description: 'Send a file', category: 'Telegram' },
  { type: 'send_location', label: 'Send Location', icon: '📍', description: 'Send a map location', category: 'Telegram' },
  // Input
  { type: 'wait_input', label: 'Wait for Input', icon: '⏳', description: 'Wait for user text input', category: 'Input' },
  { type: 'wait_choice', label: 'Wait for Choice', icon: '☝️', description: 'Wait for button selection', category: 'Input' },
  // Logic
  { type: 'condition', label: 'IF Condition', icon: '🔀', description: 'Branch based on condition', category: 'Logic' },
  { type: 'switch', label: 'Switch', icon: '🔃', description: 'Multi-branch switch', category: 'Logic' },
  { type: 'delay', label: 'Delay', icon: '⏱️', description: 'Wait before continuing', category: 'Logic' },
  // Data
  { type: 'set_variable', label: 'Set Variable', icon: '📝', description: 'Set a workflow variable', category: 'Data' },
  { type: 'api_call', label: 'API Call', icon: '🌐', description: 'Make an HTTP request', category: 'Data' },
];
