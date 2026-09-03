import { z } from 'zod';

export const DEPRECIATION_METHODS = ['STRAIGHT_LINE', 'DECLINING_BALANCE'] as const;
export type DepreciationMethod = (typeof DEPRECIATION_METHODS)[number];

export const ASSET_STATUSES = ['ACTIVE', 'DISPOSED', 'MAINTENANCE'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const createFixedAssetSchema = z.object({
  assetCode: z.string().min(1).max(30),
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  purchaseDate: z.string(),
  purchaseCost: z.number().positive(),
  salvageValue: z.number().min(0).optional(),
  usefulLifeMonths: z.number().int().positive().optional(),
  depreciationMethod: z.enum(DEPRECIATION_METHODS).optional(),
  locationId: z.string().optional(),
});
export type CreateFixedAssetInput = z.infer<typeof createFixedAssetSchema>;

export interface DepreciationRecordDto {
  id: string;
  assetId: string;
  periodDate: string;
  amount: number;
  bookValueAfter: number;
  journalEntryId?: string | null;
  createdAt: string;
}

export interface FixedAssetDto {
  id: string;
  organizationId: string;
  assetCode: string;
  name: string;
  category: string;
  purchaseDate: string;
  purchaseCost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  depreciationMethod: DepreciationMethod;
  accumulatedDeprec: number;
  currentBookValue: number;
  status: AssetStatus;
  locationId?: string | null;
  records?: DepreciationRecordDto[];
  createdAt: string;
  updatedAt: string;
}
