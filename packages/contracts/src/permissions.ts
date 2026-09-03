/**
 * RBAC roles and permission strings (spec §12, §68).
 *
 * Permissions are `<resource>.<action>` strings. This convention scales to
 * every module (customers.read, sales.write, inventory.read, ...).
 */

export const ROLES = [
  'SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'ORG_ADMIN',
  'COMPANY_ADMIN',
  'BRANCH_MANAGER',
  'FINANCE_MANAGER',
  'SALES_MANAGER',
  'WAREHOUSE_MANAGER',
  'CASHIER',
  'ACCOUNTANT',
  'STAFF',
  'AUDITOR',
  'CUSTOMER',
  'PARTNER',
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  // Products
  PRODUCTS_READ: 'products.read',
  PRODUCTS_WRITE: 'products.write',
  // Customers
  CUSTOMERS_READ: 'customers.read',
  CUSTOMERS_WRITE: 'customers.write',
  // Sales
  SALES_READ: 'sales.read',
  SALES_WRITE: 'sales.write',
  SALES_VOID: 'sales.void',
  SALES_REFUND: 'sales.refund',
  // Inventory
  INVENTORY_READ: 'inventory.read',
  INVENTORY_ADJUST: 'inventory.adjust',
  // Locations
  LOCATIONS_READ: 'locations.read',
  LOCATIONS_WRITE: 'locations.write',
  // Organizations & Settings
  ORGANIZATIONS_READ: 'organizations.read',
  ORGANIZATIONS_WRITE: 'organizations.write',
  // Procurement & Purchasing
  PROCUREMENT_READ: 'procurement.read',
  PROCUREMENT_WRITE: 'procurement.write',
  PROCUREMENT_APPROVE: 'procurement.approve',
  PROCUREMENT_RECEIVE: 'procurement.receive',
  // Promotions & Discounts
  PROMOTIONS_READ: 'promotions.read',
  PROMOTIONS_WRITE: 'promotions.write',
  // Pricing & Price Lists
  PRICING_READ: 'pricing.read',
  PRICING_WRITE: 'pricing.write',
  // Payments & Gateways
  PAYMENTS_READ: 'payments.read',
  PAYMENTS_WRITE: 'payments.write',
  // WMS & Stock Transfers
  WMS_READ: 'wms.read',
  WMS_WRITE: 'wms.write',
  TRANSFERS_READ: 'transfers.read',
  TRANSFERS_WRITE: 'transfers.write',
  TRANSFERS_APPROVE: 'transfers.approve',
  TRANSFERS_RECEIVE: 'transfers.receive',
  // Taxes & Fiscal Rules
  TAXES_READ: 'taxes.read',
  TAXES_WRITE: 'taxes.write',
  // Customer Loyalty & Store Credit
  LOYALTY_READ: 'loyalty.read',
  LOYALTY_WRITE: 'loyalty.write',
  // Storage & Documents Platform
  STORAGE_READ: 'storage.read',
  STORAGE_WRITE: 'storage.write',
  // Notifications Platform
  NOTIFICATIONS_READ: 'notifications.read',
  NOTIFICATIONS_WRITE: 'notifications.write',
  // Reporting & Business Intelligence (BI) Platform
  REPORTS_READ: 'reports.read',
  REPORTS_EXPORT: 'reports.export',
  // Finance & Accounting Platform
  FINANCE_READ: 'finance.read',
  FINANCE_WRITE: 'finance.write',
  JOURNAL_POST: 'journal.post',
  // Workflow & Approvals Engine
  WORKFLOW_READ: 'workflow.read',
  WORKFLOW_MANAGE: 'workflow.manage',
  WORKFLOW_APPROVE: 'workflow.approve',
  // HR & Payroll Platform
  HR_READ: 'hr.read',
  HR_WRITE: 'hr.write',
  PAYROLL_RUN: 'payroll.run',
  // Fixed Assets Platform
  ASSETS_READ: 'assets.read',
  ASSETS_WRITE: 'assets.write',
  // Projects & Billing
  PROJECTS_READ: 'projects.read',
  PROJECTS_WRITE: 'projects.write',
  // Service Management & Helpdesk
  TICKETS_READ: 'tickets.read',
  TICKETS_WRITE: 'tickets.write',
  // Partner & Developer Platform
  DEVELOPER_READ: 'developer.read',
  DEVELOPER_WRITE: 'developer.write',
  WEBHOOKS_MANAGE: 'webhooks.manage',
  // Telegram Platform
  TELEGRAM_MANAGE: 'telegram.manage',
  // Flow Automation Platform (n8n Engine)
  AUTOMATION_READ: 'automation.read',
  AUTOMATION_WRITE: 'automation.write',
  AUTOMATION_EXECUTE: 'automation.execute',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
