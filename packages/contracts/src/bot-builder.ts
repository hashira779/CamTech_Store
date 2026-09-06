import { z } from 'zod';

// ─── Bot Workflow Status ────────────────────────────────────────────────────

export const BOT_WORKFLOW_STATUSES = ['DRAFT', 'PUBLISHED', 'PAUSED'] as const;
export type BotWorkflowStatus = (typeof BOT_WORKFLOW_STATUSES)[number];

// ─── Node Types ─────────────────────────────────────────────────────────────

export const BOT_NODE_TYPES = [
  // Triggers
  'start', 'command_received', 'message_received', 'callback_query', 'webhook_received',
  'order_created_trigger', 'payment_received_trigger', 'delivery_update_trigger',
  // Telegram UX
  'send_message', 'edit_message', 'delete_message',
  'show_inline_keyboard', 'show_reply_keyboard', 'remove_keyboard',
  'answer_callback', 'send_photo', 'send_document', 'send_location',
  'chat_action', 'pin_message', 'request_contact',
  // Store & Catalog
  'search_products', 'get_product', 'list_categories', 'check_stock', 'get_promotions',
  // Orders & Checkout
  'create_order', 'get_order_status', 'list_recent_orders', 'cancel_order', 'generate_invoice',
  // Payments & KHQR
  'generate_khqr', 'check_payment', 'confirm_cod', 'request_refund',
  // Delivery & Fleet
  'estimate_delivery', 'track_delivery', 'dispatch_courier', 'confirm_delivery',
  // CRM & Customers
  'lookup_customer', 'register_customer', 'update_loyalty_points', 'add_customer_note',
  // Support & Team
  'agent_handoff', 'create_support_ticket', 'alert_admin',
  // Input
  'wait_input', 'wait_choice',
  // Logic & Flow
  'condition', 'switch', 'delay', 'business_hours', 'random_split',
  // Data & APIs
  'set_variable', 'api_call', 'format_currency',
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
  // ─── Triggers ──────────────────────────────────────────────────────────────
  { type: 'start', label: 'Bot Started', icon: '🚀', description: 'Entry point when bot starts (/start)', category: 'Triggers' },
  { type: 'command_received', label: 'Command Received', icon: '⌘', description: 'Triggered by a /command', category: 'Triggers' },
  { type: 'message_received', label: 'Message Received', icon: '💬', description: 'Triggered by any text message', category: 'Triggers' },
  { type: 'callback_query', label: 'Button Clicked', icon: '👆', description: 'Triggered by inline button click', category: 'Triggers' },
  { type: 'order_created_trigger', label: 'Order Created', icon: '📦', description: 'Fires when new order is placed', category: 'Triggers' },
  { type: 'payment_received_trigger', label: 'Payment Received', icon: '💰', description: 'Fires when KHQR payment confirms', category: 'Triggers' },
  { type: 'delivery_update_trigger', label: 'Delivery Updated', icon: '🚚', description: 'Fires when courier status changes', category: 'Triggers' },
  { type: 'webhook_received', label: 'Webhook Received', icon: '🔗', description: 'Triggered by external HTTP webhook', category: 'Triggers' },

  // ─── Telegram UX ───────────────────────────────────────────────────────────
  { type: 'show_inline_keyboard', label: 'Inline Buttons', icon: '⌨️', description: 'Send message with interactive buttons', category: 'Telegram' },
  { type: 'send_message', label: 'Send Message', icon: '📤', description: 'Send a formatted text message', category: 'Telegram' },
  { type: 'show_reply_keyboard', label: 'Reply Keyboard', icon: '🎹', description: 'Persistent bottom keyboard menu', category: 'Telegram' },
  { type: 'remove_keyboard', label: 'Remove Keyboard', icon: '🚫', description: 'Dismiss reply keyboard from screen', category: 'Telegram' },
  { type: 'send_photo', label: 'Send Photo', icon: '📸', description: 'Send product or promo image', category: 'Telegram' },
  { type: 'send_document', label: 'Send Document', icon: '📄', description: 'Send PDF receipt, bill or file', category: 'Telegram' },
  { type: 'send_location', label: 'Send Location', icon: '📍', description: 'Send store or pickup map location', category: 'Telegram' },
  { type: 'chat_action', label: 'Typing Indicator', icon: '💬', description: 'Show typing or uploading animation', category: 'Telegram' },
  { type: 'pin_message', label: 'Pin Message', icon: '📌', description: 'Pin message to top of user chat', category: 'Telegram' },
  { type: 'request_contact', label: 'Request Phone', icon: '📞', description: 'Ask user to share verified phone', category: 'Telegram' },
  { type: 'edit_message', label: 'Edit Message', icon: '✏️', description: 'Update text of existing message', category: 'Telegram' },
  { type: 'delete_message', label: 'Delete Message', icon: '🗑️', description: 'Delete previous message', category: 'Telegram' },

  // ─── Store & Catalog (Direct DB Integration) ────────────────────────────────
  { type: 'search_products', label: 'Search Products', icon: '🔍', description: 'Query store catalog by title/category', category: 'Catalog' },
  { type: 'get_product', label: 'Product Details', icon: '🏷️', description: 'Fetch price, variants & photo', category: 'Catalog' },
  { type: 'list_categories', label: 'List Categories', icon: '📑', description: 'Generate buttons from store categories', category: 'Catalog' },
  { type: 'check_stock', label: 'Check Stock', icon: '📊', description: 'Real-time inventory level check', category: 'Catalog' },
  { type: 'get_promotions', label: 'Active Promos', icon: '🎁', description: 'Fetch active discounts and coupons', category: 'Catalog' },

  // ─── Orders & Checkout ─────────────────────────────────────────────────────
  { type: 'get_order_status', label: 'Track Order', icon: '📋', description: 'Query order by ID or customer phone', category: 'Orders' },
  { type: 'list_recent_orders', label: 'Recent Orders', icon: '🧾', description: 'Show user last 5 orders with status', category: 'Orders' },
  { type: 'create_order', label: 'Create Order', icon: '🛒', description: 'Generate sales order in MyStore', category: 'Orders' },
  { type: 'cancel_order', label: 'Cancel Order', icon: '❌', description: 'Cancel pending unpaid order', category: 'Orders' },
  { type: 'generate_invoice', label: 'Invoice PDF', icon: '📄', description: 'Generate branded PDF receipt/bill', category: 'Orders' },

  // ─── Payments & Bakong KHQR ────────────────────────────────────────────────
  { type: 'generate_khqr', label: 'Generate KHQR', icon: '🇰🇭', description: 'Generate Bakong KHQR dynamic QR image', category: 'Payments' },
  { type: 'check_payment', label: 'Payment Status', icon: '💳', description: 'Verify if KHQR/card was paid', category: 'Payments' },
  { type: 'confirm_cod', label: 'Cash On Delivery', icon: '💵', description: 'Mark order payment as Cash on Delivery', category: 'Payments' },
  { type: 'request_refund', label: 'Refund Ticket', icon: '🔄', description: 'Submit customer refund request', category: 'Payments' },

  // ─── Delivery & Logistics ──────────────────────────────────────────────────
  { type: 'track_delivery', label: 'Track Courier', icon: '🗺️', description: 'Real-time delivery status & driver', category: 'Delivery' },
  { type: 'estimate_delivery', label: 'Delivery Fee', icon: '🛵', description: 'Calculate delivery fee by distance', category: 'Delivery' },
  { type: 'dispatch_courier', label: 'Dispatch Driver', icon: '📦', description: 'Assign courier to ready order', category: 'Delivery' },
  { type: 'confirm_delivery', label: 'Confirm Received', icon: '🏁', description: 'Mark delivery package as received', category: 'Delivery' },

  // ─── CRM & Customers ───────────────────────────────────────────────────────
  { type: 'lookup_customer', label: 'Customer Profile', icon: '👤', description: 'Fetch loyalty tier & point balance', category: 'CRM' },
  { type: 'register_customer', label: 'Register Member', icon: '📝', description: 'Save name & phone to customer CRM', category: 'CRM' },
  { type: 'update_loyalty_points', label: 'Award Points', icon: '⭐', description: 'Add/deduct customer reward points', category: 'CRM' },
  { type: 'add_customer_note', label: 'Customer Note', icon: '🗒️', description: 'Save staff note on customer record', category: 'CRM' },

  // ─── Support & Team ────────────────────────────────────────────────────────
  { type: 'agent_handoff', label: 'Agent Handoff', icon: '🧑‍💼', description: 'Forward chat to human support staff', category: 'Support' },
  { type: 'create_support_ticket', label: 'Create Ticket', icon: '🎫', description: 'Open customer issue ticket in system', category: 'Support' },
  { type: 'alert_admin', label: 'Alert Manager', icon: '🚨', description: 'Send instant alert to admin Telegram chat', category: 'Support' },

  // ─── User Input ────────────────────────────────────────────────────────────
  { type: 'wait_input', label: 'Wait for Text', icon: '⏳', description: 'Pause and wait for user text reply', category: 'Input' },
  { type: 'wait_choice', label: 'Wait for Choice', icon: '☝️', description: 'Pause and wait for user button tap', category: 'Input' },

  // ─── Logic & Automation ────────────────────────────────────────────────────
  { type: 'condition', label: 'IF Condition', icon: '🔀', description: 'Branch based on variable evaluation', category: 'Logic' },
  { type: 'switch', label: 'Switch Branch', icon: '🔃', description: 'Multi-branch based on exact match', category: 'Logic' },
  { type: 'business_hours', label: 'Business Hours', icon: '🕒', description: 'Branch if store is open or closed', category: 'Logic' },
  { type: 'random_split', label: 'A/B Test Split', icon: '🎲', description: 'Split traffic (e.g. 50% A, 50% B)', category: 'Logic' },
  { type: 'delay', label: 'Delay Timer', icon: '⏱️', description: 'Wait X seconds before next step', category: 'Logic' },

  // ─── Data & APIs ───────────────────────────────────────────────────────────
  { type: 'set_variable', label: 'Set Variable', icon: '📝', description: 'Store value into conversation context', category: 'Data' },
  { type: 'api_call', label: 'REST API Call', icon: '🌐', description: 'HTTP GET/POST/PUT to external REST API', category: 'Data' },
  { type: 'format_currency', label: 'Format Currency', icon: '💲', description: 'Format number to $USD or ៛KHR', category: 'Data' },
];

// ─── Enterprise Starter Templates ───────────────────────────────────────────

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  nodes: BotNode[];
  edges: BotEdge[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'ecommerce_store',
    name: '🛍️ E-Commerce Store & Ordering',
    description: 'Interactive storefront with product catalog, cart summary, and KHQR checkout.',
    category: 'Store',
    icon: '🛍️',
    nodes: [
      {
        id: 'start-1',
        type: 'start',
        position: { x: 250, y: 50 },
        data: { label: 'Start Bot', config: {} },
      },
      {
        id: 'menu-1',
        type: 'show_inline_keyboard',
        position: { x: 250, y: 180 },
        data: {
          label: 'Welcome Menu',
          config: {
            message: '👋 Welcome to CamTech Store! How can we help you today?',
            columns: 2,
            buttons: [
              { text: '🛍️ View Products', callbackData: 'browse_catalog' },
              { text: '📦 Track Order', callbackData: 'track_order' },
              { text: '🎁 Promotions', callbackData: 'promos' },
              { text: '💬 Support', callbackData: 'support' },
            ],
          },
        },
      },
      {
        id: 'catalog-1',
        type: 'search_products',
        position: { x: 250, y: 350 },
        data: {
          label: 'Display Featured Catalog',
          config: { limit: 5, includePhoto: true },
        },
      },
      {
        id: 'payment-1',
        type: 'generate_khqr',
        position: { x: 250, y: 500 },
        data: {
          label: 'Bakong KHQR Payment',
          config: { currency: 'USD', description: 'CamTech Store Order' },
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'menu-1' },
      { id: 'e2', source: 'menu-1', target: 'catalog-1' },
      { id: 'e3', source: 'catalog-1', target: 'payment-1' },
    ],
  },
  {
    id: 'order_tracking',
    name: '📦 Live Order & Courier Tracking',
    description: 'Instant lookup of customer order status and delivery courier GPS updates.',
    category: 'Orders',
    icon: '📦',
    nodes: [
      {
        id: 'start-track',
        type: 'start',
        position: { x: 250, y: 50 },
        data: { label: 'Start Tracker', config: {} },
      },
      {
        id: 'ask-order',
        type: 'show_inline_keyboard',
        position: { x: 250, y: 180 },
        data: {
          label: 'Tracking Options',
          config: {
            message: '📦 CamTech Order Tracking System\nSelect an option below:',
            columns: 1,
            buttons: [
              { text: '🧾 View My Recent Orders', callbackData: 'my_orders' },
              { text: '🔍 Enter Order Number', callbackData: 'enter_code' },
            ],
          },
        },
      },
      {
        id: 'track-node',
        type: 'get_order_status',
        position: { x: 250, y: 340 },
        data: { label: 'Lookup Order Status', config: {} },
      },
      {
        id: 'delivery-node',
        type: 'track_delivery',
        position: { x: 250, y: 480 },
        data: { label: 'Live Courier Status', config: {} },
      },
    ],
    edges: [
      { id: 'et1', source: 'start-track', target: 'ask-order' },
      { id: 'et2', source: 'ask-order', target: 'track-node' },
      { id: 'et3', source: 'track-node', target: 'delivery-node' },
    ],
  },
  {
    id: 'khqr_checkout',
    name: '🇰🇭 Bakong KHQR Quick Pay',
    description: 'Instant dynamic QR code generation for digital payments in USD or KHR.',
    category: 'Payments',
    icon: '🇰🇭',
    nodes: [
      {
        id: 'start-pay',
        type: 'start',
        position: { x: 250, y: 50 },
        data: { label: 'Start Payment', config: {} },
      },
      {
        id: 'khqr-gen',
        type: 'generate_khqr',
        position: { x: 250, y: 180 },
        data: {
          label: 'Generate Bakong QR',
          config: { currency: 'USD', amount: 5.0, description: 'Quick Payment' },
        },
      },
      {
        id: 'pay-check',
        type: 'check_payment',
        position: { x: 250, y: 320 },
        data: { label: 'Verify Payment Receipt', config: {} },
      },
      {
        id: 'pay-thanks',
        type: 'send_message',
        position: { x: 250, y: 460 },
        data: {
          label: 'Payment Receipt Sent',
          config: { message: '✅ Payment received successfully! Your receipt has been saved.' },
        },
      },
    ],
    edges: [
      { id: 'ep1', source: 'start-pay', target: 'khqr-gen' },
      { id: 'ep2', source: 'khqr-gen', target: 'pay-check' },
      { id: 'ep3', source: 'pay-check', target: 'pay-thanks' },
    ],
  },
  {
    id: 'customer_support',
    name: '🎫 Support & Human Agent Handoff',
    description: 'Answers FAQs, creates support tickets, and transfers VIP inquiries to live staff.',
    category: 'Support',
    icon: '🎫',
    nodes: [
      {
        id: 'start-sup',
        type: 'start',
        position: { x: 250, y: 50 },
        data: { label: 'Start Support', config: {} },
      },
      {
        id: 'sup-menu',
        type: 'show_inline_keyboard',
        position: { x: 250, y: 180 },
        data: {
          label: 'Support Options',
          config: {
            message: '💬 Welcome to CamTech Helpdesk!\nHow can we help you?',
            columns: 1,
            buttons: [
              { text: '❓ Frequently Asked Questions', callbackData: 'faq' },
              { text: '🎫 Open Support Ticket', callbackData: 'new_ticket' },
              { text: '🧑‍💼 Speak to Live Agent', callbackData: 'agent_handoff' },
            ],
          },
        },
      },
      {
        id: 'admin-alert',
        type: 'alert_admin',
        position: { x: 250, y: 340 },
        data: {
          label: 'Notify Support Team',
          config: { message: '🚨 Customer requested live assistance in Telegram!' },
        },
      },
      {
        id: 'handoff-node',
        type: 'agent_handoff',
        position: { x: 250, y: 480 },
        data: { label: 'Connect to Live Staff', config: {} },
      },
    ],
    edges: [
      { id: 'es1', source: 'start-sup', target: 'sup-menu' },
      { id: 'es2', source: 'sup-menu', target: 'admin-alert' },
      { id: 'es3', source: 'admin-alert', target: 'handoff-node' },
    ],
  },
];

