export interface TelegramCommandContext {
  organizationName: string;
  todaySalesTotal: number;
  todaySalesCount: number;
  lowStockItemsCount: number;
  topDepletedItemNames?: string[];
  pendingApprovalsCount: number;
}

export class TelegramCommandRouter {
  /**
   * Evaluates an incoming Telegram slash command and formats a structured response.
   */
  static handleCommand(commandText: string, ctx: TelegramCommandContext): string {
    const trimmed = commandText.trim();
    const parts = trimmed.split(' ');
    const baseCommand = parts[0].toLowerCase().split('@')[0]; // strip bot username if present, e.g. /sales@mybot
    const argument = parts.slice(1).join(' ').trim();

    switch (baseCommand) {
      case '/start':
      case '/help':
        return [
          `🏢 *${ctx.organizationName} Enterprise Bot*`,
          '',
          'Available operational commands:',
          '• `/sales` — Today’s sales volume & transaction counts',
          '• `/stock` — Depleted & low inventory count',
          '• `/orders` — Status of active & pending orders',
          '• `/approve <id>` — Sign off a pending workflow request',
          '• `/help` — Display this command reference',
        ].join('\n');

      case '/sales':
        return [
          `📊 *Sales Performance Summary* (${ctx.organizationName})`,
          `📅 Date: ${new Date().toISOString().split('T')[0]}`,
          '',
          `• Total Gross Revenue: *$${ctx.todaySalesTotal.toFixed(2)}*`,
          `• Completed Transactions: *${ctx.todaySalesCount}*`,
          `• Average Order Value: *$${ctx.todaySalesCount > 0 ? (ctx.todaySalesTotal / ctx.todaySalesCount).toFixed(2) : '0.00'}*`,
        ].join('\n');

      case '/stock':
        const itemsList = ctx.topDepletedItemNames && ctx.topDepletedItemNames.length > 0
          ? `\nItems needing replenishment:\n${ctx.topDepletedItemNames.map((n) => `  ⚠️ ${n}`).join('\n')}`
          : '';
        return [
          `📦 *Inventory Health Report*`,
          `• Depleted / Low Stock SKUs: *${ctx.lowStockItemsCount}*`,
          itemsList,
        ].join('\n');

      case '/orders':
        return [
          `🛒 *Orders & Transactions*`,
          `• Processed Today: *${ctx.todaySalesCount} orders*`,
          `• Pending Approvals: *${ctx.pendingApprovalsCount} workflows*`,
        ].join('\n');

      case '/approve':
        if (!argument) {
          return `⚠️ *Missing ID*: Please specify the workflow instance ID to approve. Example: \`/approve wf_cuid_123\``;
        }
        return `✅ Approval submitted for workflow instance \`${argument}\`. Verification in progress.`;

      default:
        return `❓ Unknown command \`${baseCommand}\`. Type \`/help\` for a list of available enterprise commands.`;
    }
  }
}
