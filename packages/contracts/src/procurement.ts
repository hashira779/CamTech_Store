import { z } from 'zod';
import { CURRENCIES } from './products';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PO_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'PARTIALLY_RECEIVED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type PurchaseOrderStatus = (typeof PO_STATUSES)[number];

export const GRN_STATUSES = ['DRAFT', 'COMPLETED', 'CANCELLED'] as const;
export type GoodsReceiptStatus = (typeof GRN_STATUSES)[number];

export const PAYMENT_TERMS = ['IMMEDIATE', 'NET_15', 'NET_30', 'NET_60', 'COD'] as const;
export type PaymentTerm = (typeof PAYMENT_TERMS)[number];

// ---------------------------------------------------------------------------
// Supplier Schemas
// ---------------------------------------------------------------------------

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Supplier name is required').max(200),
  code: z
    .string()
    .trim()
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, 'Code must be alphanumeric')
    .optional()
    .nullable(),
  contactPerson: z.string().trim().max(100).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  taxId: z.string().trim().max(50).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  paymentTerms: z.enum(PAYMENT_TERMS).optional().default('NET_30'),
  notes: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export type CreateSupplierInput = z.input<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial();
export type UpdateSupplierInput = z.input<typeof updateSupplierSchema>;

export const listSuppliersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
});

export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;

// ---------------------------------------------------------------------------
// Purchase Order Schemas
// ---------------------------------------------------------------------------

export const poLineItemInputSchema = z.object({
  productVariantId: z.string().min(1, 'Product variant ID is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitCost: z.number().min(0, 'Unit cost cannot be negative'),
  taxRatePct: z.number().min(0).max(100).optional().default(0),
});

export type POLineItemInput = z.input<typeof poLineItemInputSchema>;

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  locationId: z.string().min(1, 'Destination location is required'),
  expectedDeliveryDate: z.string().optional().nullable(),
  currency: z.enum(CURRENCIES).optional().default('USD'),
  notes: z.string().trim().max(2000).optional().nullable(),
  lineItems: z.array(poLineItemInputSchema).min(1, 'At least one line item is required'),
});

export type CreatePurchaseOrderInput = z.input<typeof createPurchaseOrderSchema>;

export const updatePurchaseOrderSchema = z.object({
  notes: z.string().trim().max(2000).optional().nullable(),
  expectedDeliveryDate: z.string().optional().nullable(),
});

export type UpdatePurchaseOrderInput = z.input<typeof updatePurchaseOrderSchema>;

export const listPurchaseOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(PO_STATUSES).optional(),
  supplierId: z.string().optional(),
  locationId: z.string().optional(),
  search: z.string().trim().max(100).optional(),
});

export type ListPurchaseOrdersQuery = z.infer<typeof listPurchaseOrdersQuerySchema>;

// ---------------------------------------------------------------------------
// Goods Receipt Note (GRN) Schemas
// ---------------------------------------------------------------------------

export const grnLineItemInputSchema = z.object({
  poLineItemId: z.string().min(1, 'PO line item ID is required'),
  productVariantId: z.string().min(1, 'Product variant ID is required'),
  quantityReceived: z.number().positive('Received quantity must be positive'),
});

export type GRNLineItemInput = z.input<typeof grnLineItemInputSchema>;

export const createGoodsReceiptSchema = z.object({
  notes: z.string().trim().max(2000).optional().nullable(),
  lineItems: z.array(grnLineItemInputSchema).min(1, 'At least one item must be received'),
});

export type CreateGoodsReceiptInput = z.input<typeof createGoodsReceiptSchema>;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface SupplierDto {
  id: string;
  organizationId: string;
  code: string | null;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  address: string | null;
  paymentTerms: PaymentTerm;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { purchaseOrders: number };
}

export interface POLineItemDto {
  id: string;
  purchaseOrderId: string;
  productVariantId: string;
  sku: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  receivedQty: number;
  unitCost: number;
  taxRatePct: number;
  taxAmount: number;
  lineTotal: number;
}

export interface PurchaseOrderDto {
  id: string;
  organizationId: string;
  locationId: string;
  supplierId: string;
  poNumber: string;
  orderDate: string;
  expectedDeliveryDate: string | null;
  status: PurchaseOrderStatus;
  currency: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: { id: string; name: string; code: string | null };
  location: { id: string; name: string; code: string | null };
  lineItems: POLineItemDto[];
}

export interface PurchaseOrderSummaryDto {
  id: string;
  poNumber: string;
  supplierName: string;
  locationName: string;
  status: PurchaseOrderStatus;
  grandTotal: number;
  currency: string;
  orderDate: string;
  itemCount: number;
  expectedDeliveryDate: string | null;
}

export interface GRNLineItemDto {
  id: string;
  goodsReceiptId: string;
  poLineItemId: string;
  productVariantId: string;
  productName: string;
  sku: string;
  quantityReceived: number;
  unitCost: number;
}

export interface GoodsReceiptDto {
  id: string;
  organizationId: string;
  locationId: string;
  purchaseOrderId: string;
  supplierId: string;
  grnNumber: string;
  receivedDate: string;
  status: GoodsReceiptStatus;
  notes: string | null;
  createdAt: string;
  supplierName: string;
  locationName: string;
  poNumber: string;
  lineItems: GRNLineItemDto[];
}
