import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LOCATION_TYPES = [
  'COMPANY',
  'BUSINESS_UNIT',
  'REGION',
  'BRANCH',
  'DEPARTMENT',
  'WAREHOUSE',
  'POS',
] as const;

export type LocationType = (typeof LOCATION_TYPES)[number];

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const createLocationSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  type: z.enum(LOCATION_TYPES),
  code: z
    .string()
    .trim()
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, 'Code may contain alphanumeric characters, hyphens, and underscores')
    .optional()
    .nullable(),
  parentId: z.string().optional().nullable(),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;

export const updateLocationSchema = createLocationSchema.partial();
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

export const listLocationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  type: z.enum(LOCATION_TYPES).optional(),
  parentId: z.string().optional().nullable(),
});

export type ListLocationsQuery = z.infer<typeof listLocationsQuerySchema>;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface LocationDto {
  id: string;
  organizationId: string;
  parentId: string | null;
  type: LocationType;
  name: string;
  code: string | null;
  createdAt: string;
  updatedAt: string;
  parent?: { id: string; name: string; type: LocationType } | null;
  childrenCount?: number;
}

export interface LocationTreeNodeDto {
  id: string;
  organizationId: string;
  parentId: string | null;
  type: LocationType;
  name: string;
  code: string | null;
  createdAt: string;
  children: LocationTreeNodeDto[];
}
