import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CUSTOMER_TYPES = ['INDIVIDUAL', 'COMPANY', 'WHOLESALE', 'GOVERNMENT', 'INTERNAL'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().email().optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  taxId: z.string().trim().max(50).optional().nullable(),
  type: z.enum(CUSTOMER_TYPES).default('INDIVIDUAL'),
  priceListId: z.string().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type CreateCustomerInput = z.input<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.partial();
export type UpdateCustomerInput = z.input<typeof updateCustomerSchema>;

export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  type: z.enum(CUSTOMER_TYPES).optional(),
});

export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CustomerDto {
  id: string;
  organizationId: string;
  code: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  type: CustomerType;
  priceListId?: string | null;
  priceListName?: string | null;
  loyaltyPoints?: number;
  loyaltyTier?: string;
  storeCredit?: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
