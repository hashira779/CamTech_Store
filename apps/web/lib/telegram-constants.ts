import type { TelegramBotPurpose } from '@mystore/contracts';

/**
 * Single source of truth for Telegram bot purpose options.
 * Used by AddBotModal, EditBotModal, and the page's PURPOSE_CONFIG.
 */
export const PURPOSE_OPTIONS: { value: TelegramBotPurpose; label: string }[] = [
  { value: 'SALES', label: 'Sales & POS' },
  { value: 'DELIVERY', label: 'Delivery & Fleet' },
  { value: 'INVENTORY', label: 'Inventory & WMS' },
  { value: 'FINANCE', label: 'Finance & Approvals' },
  { value: 'SUPPORT', label: 'Customer Support' },
  { value: 'GENERAL', label: 'General Operations' },
];
