import { z } from 'zod';
import { CURRENCIES, UNITS } from './products';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SALE_STATUSES = ['DRAFT', 'COMPLETED', 'VOIDED', 'REFUNDED', 'PARTIALLY_REFUNDED'] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export const PAYMENT_METHODS = ['CASH', 'CARD', 'QR', 'BANK_TRANSFER', 'WALLET', 'CREDIT', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SALE_CHANNELS = ['POS', 'WEB', 'MOBILE', 'API', 'TELEGRAM'] as const;
export type SaleChannel = (typeof SALE_CHANNELS)[number];

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

/** A line item submitted by the client. Price is NOT trusted — server will look it up. */
export const saleLineItemInputSchema = z.object({
  productVariantId: z.string().min(1, 'Product variant ID is required'),
  quantity: z.number().positive('Quantity must be positive'),
  /** Client-suggested discount (server will validate/apply). */
  discount: z.number().min(0).default(0),
});

export const salePaymentInputSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amount: z.number().positive('Payment amount must be positive'),
  reference: z.string().trim().max(200).optional().nullable(),
});

export const createSaleSchema = z.object({
  customerId: z.string().optional().nullable(),
  locationId: z.string().optional().nullable(),
  channel: z.enum(SALE_CHANNELS).default('POS'),
  currency: z.enum(CURRENCIES).default('USD'),
  notes: z.string().trim().max(2000).optional().nullable(),
  /** Idempotency key (spec §15). Required for POS transactions. */
  idempotencyKey: z.string().trim().max(100).optional().nullable(),
  /** Optional promo coupon code applied to this sale. */
  promoCode: z.string().trim().max(50).optional().nullable(),
  lineItems: z.array(saleLineItemInputSchema).min(1, 'At least one line item is required'),
  payments: z.array(salePaymentInputSchema).min(1, 'At least one payment is required'),
});

export type SaleLineItemInput = z.infer<typeof saleLineItemInputSchema>;
export type SalePaymentInput = z.infer<typeof salePaymentInputSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const listSalesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(SALE_STATUSES).optional(),
  channel: z.enum(SALE_CHANNELS).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().trim().max(200).optional(),
});

export type ListSalesQuery = z.infer<typeof listSalesQuerySchema>;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface SaleLineItemDto {
  id: string;
  productVariantId: string;
  sku: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRatePct: number;
  taxAmount: number;
  lineTotal: number;
}

export interface SalePaymentDto {
  id: string;
  method: PaymentMethod;
  amount: number;
  status?: string;
  provider?: string | null;
  reference: string | null;
  qrString?: string | null;
  paidAt: string;
}

export interface SaleDto {
  id: string;
  organizationId: string;
  locationId: string | null;
  customerId: string | null;
  userId: string;
  saleNumber: string;
  channel: SaleChannel;
  status: SaleStatus;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  currency: string;
  promotionCode?: string | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems: SaleLineItemDto[];
  payments: SalePaymentDto[];
  customer?: { id: string; name: string; code: string | null } | null;
}

/** Summary DTO used in list views (without full line items). */
export interface SaleSummaryDto {
  id: string;
  saleNumber: string;
  channel: SaleChannel;
  status: SaleStatus;
  grandTotal: number;
  currency: string;
  promotionCode?: string | null;
  customerName: string | null;
  itemCount: number;
  completedAt: string | null;
  createdAt: string;
}
