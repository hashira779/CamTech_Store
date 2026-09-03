import { z } from 'zod';

export const REPORT_INTERVALS = ['DAY', 'WEEK', 'MONTH'] as const;
export type ReportInterval = (typeof REPORT_INTERVALS)[number];

export const REPORT_EXPORT_TYPES = ['SALES', 'INVENTORY', 'PRODUCTS'] as const;
export type ReportExportType = (typeof REPORT_EXPORT_TYPES)[number];

export const reportDateRangeQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  locationId: z.string().optional(),
  interval: z.enum(REPORT_INTERVALS).optional(),
});

export type ReportDateRangeQuery = z.infer<typeof reportDateRangeQuerySchema>;

export const exportReportQuerySchema = z.object({
  type: z.enum(REPORT_EXPORT_TYPES),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  locationId: z.string().optional(),
});

export type ExportReportQuery = z.infer<typeof exportReportQuerySchema>;

export interface SalesSummaryDto {
  grossRevenue: number;
  discountTotal: number;
  netRevenue: number;
  taxTotal: number;
  cogs: number;
  grossMargin: number;
  grossMarginPct: number;
  orderCount: number;
  averageOrderValue: number;
}

export interface PaymentBreakdownDto {
  method: string;
  count: number;
  totalAmount: number;
  percentage: number;
}

export interface TimeSeriesPointDto {
  date: string;
  revenue: number;
  orders: number;
  margin: number;
}

export interface TopProductDto {
  productId: string;
  variantId: string;
  name: string;
  sku: string;
  categoryName?: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  margin: number;
  marginPct: number;
}

export interface InventoryHealthDto {
  totalSkuCount: number;
  totalUnitsOnHand: number;
  totalAssetCostValue: number;
  totalPotentialRetailValue: number;
  lowStockItemCount: number;
  outOfStockCount: number;
}

export interface BranchPerformanceDto {
  locationId: string;
  locationName: string;
  revenue: number;
  orderCount: number;
  aov: number;
}

export interface ExecutiveReportSummaryDto {
  sales: SalesSummaryDto;
  payments: PaymentBreakdownDto[];
  timeSeries: TimeSeriesPointDto[];
  topProducts: TopProductDto[];
  inventory: InventoryHealthDto;
  branches: BranchPerformanceDto[];
}
