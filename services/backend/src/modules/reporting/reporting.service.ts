import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type {
  ExecutiveReportSummaryDto,
  SalesSummaryDto,
  PaymentBreakdownDto,
  TimeSeriesPointDto,
  TopProductDto,
  InventoryHealthDto,
  BranchPerformanceDto,
} from '@mystore/contracts';
import { ReportDateRangeDto, ExportReportDto } from './dto/reporting.dto';

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to construct Prisma date range filters.
   */
  private buildDateFilter(startDate?: string, endDate?: string) {
    if (!startDate && !endDate) return undefined;
    const filter: { gte?: Date; lte?: Date } = {};
    if (startDate) filter.gte = new Date(startDate);
    if (endDate) filter.lte = new Date(endDate);
    return filter;
  }

  /**
   * Generates a complete executive BI reporting bundle.
   */
  async getExecutiveSummary(
    orgId: string,
    query?: ReportDateRangeDto,
  ): Promise<ExecutiveReportSummaryDto> {
    const dateFilter = this.buildDateFilter(query?.startDate, query?.endDate);
    const locationFilter = query?.locationId ? { locationId: query.locationId } : {};

    // 1. Fetch completed sales with line items and payments
    const sales = await this.prisma.sale.findMany({
      where: {
        organizationId: orgId,
        status: 'COMPLETED',
        ...locationFilter,
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      include: {
        lineItems: {
          include: {
            productVariant: {
              include: {
                product: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        },
        payments: true,
        location: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // 2. Fetch inventory items
    const inventoryItems = await this.prisma.inventoryItem.findMany({
      where: {
        organizationId: orgId,
        ...locationFilter,
      },
      include: {
        productVariant: true,
      },
    });

    // Compute all analytical dimensions
    const salesSummary = this.computeSalesSummary(sales);
    const payments = this.computePaymentBreakdown(sales);
    const timeSeries = this.computeTimeSeries(sales);
    const topProducts = this.computeTopProducts(sales);
    const inventory = this.computeInventoryHealth(inventoryItems);
    const branches = this.computeBranchPerformance(sales);

    return {
      sales: salesSummary,
      payments,
      timeSeries,
      topProducts,
      inventory,
      branches,
    };
  }

  /**
   * Computes high-level sales revenue and margin metrics.
   */
  computeSalesSummary(sales: any[]): SalesSummaryDto {
    let grossRevenue = 0;
    let discountTotal = 0;
    let netRevenue = 0;
    let taxTotal = 0;
    let cogs = 0;

    for (const sale of sales) {
      const subtotal = Number(sale.subtotal || 0);
      const discount = Number(sale.discountTotal || 0);
      const tax = Number(sale.taxTotal || 0);
      const grandTotal = Number(sale.grandTotal || 0);

      grossRevenue += subtotal + tax;
      discountTotal += discount;
      netRevenue += grandTotal;
      taxTotal += tax;

      for (const line of sale.lineItems || []) {
        const qty = Number(line.quantity || 0);
        const costPrice = Number(line.productVariant?.costPrice || 0);
        cogs += qty * costPrice;
      }
    }

    const grossMargin = netRevenue - cogs;
    const grossMarginPct = netRevenue > 0 ? (grossMargin / netRevenue) * 100 : 0;
    const orderCount = sales.length;
    const averageOrderValue = orderCount > 0 ? netRevenue / orderCount : 0;

    return {
      grossRevenue: Number(grossRevenue.toFixed(2)),
      discountTotal: Number(discountTotal.toFixed(2)),
      netRevenue: Number(netRevenue.toFixed(2)),
      taxTotal: Number(taxTotal.toFixed(2)),
      cogs: Number(cogs.toFixed(2)),
      grossMargin: Number(grossMargin.toFixed(2)),
      grossMarginPct: Number(grossMarginPct.toFixed(2)),
      orderCount,
      averageOrderValue: Number(averageOrderValue.toFixed(2)),
    };
  }

  /**
   * Breaks down sales volume across payment tender methods.
   */
  computePaymentBreakdown(sales: any[]): PaymentBreakdownDto[] {
    const map = new Map<string, { count: number; totalAmount: number }>();
    let grandTotalPaid = 0;

    for (const sale of sales) {
      for (const payment of sale.payments || []) {
        const amount = Number(payment.amount || 0);
        const method = String(payment.method || 'OTHER');
        grandTotalPaid += amount;

        const current = map.get(method) || { count: 0, totalAmount: 0 };
        current.count += 1;
        current.totalAmount += amount;
        map.set(method, current);
      }
    }

    const breakdown: PaymentBreakdownDto[] = [];
    for (const [method, data] of map.entries()) {
      breakdown.push({
        method,
        count: data.count,
        totalAmount: Number(data.totalAmount.toFixed(2)),
        percentage: grandTotalPaid > 0 ? Number(((data.totalAmount / grandTotalPaid) * 100).toFixed(1)) : 0,
      });
    }

    return breakdown.sort((a, b) => b.totalAmount - a.totalAmount);
  }

  /**
   * Aggregates time-series data grouped chronologically by day.
   */
  computeTimeSeries(sales: any[]): TimeSeriesPointDto[] {
    const map = new Map<string, { revenue: number; orders: number; cogs: number }>();

    for (const sale of sales) {
      const dateStr = new Date(sale.createdAt).toISOString().split('T')[0];
      const grandTotal = Number(sale.grandTotal || 0);

      let saleCogs = 0;
      for (const line of sale.lineItems || []) {
        saleCogs += Number(line.quantity || 0) * Number(line.productVariant?.costPrice || 0);
      }

      const current = map.get(dateStr) || { revenue: 0, orders: 0, cogs: 0 };
      current.revenue += grandTotal;
      current.orders += 1;
      current.cogs += saleCogs;
      map.set(dateStr, current);
    }

    const points: TimeSeriesPointDto[] = [];
    for (const [date, data] of map.entries()) {
      const margin = data.revenue - data.cogs;
      points.push({
        date,
        revenue: Number(data.revenue.toFixed(2)),
        orders: data.orders,
        margin: Number(margin.toFixed(2)),
      });
    }

    return points.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Identifies top products by revenue, volume, and gross margin.
   */
  computeTopProducts(sales: any[]): TopProductDto[] {
    const map = new Map<
      string,
      {
        productId: string;
        variantId: string;
        name: string;
        sku: string;
        categoryName?: string;
        unitsSold: number;
        revenue: number;
        cogs: number;
      }
    >();

    for (const sale of sales) {
      for (const line of sale.lineItems || []) {
        const variantId = line.productVariantId;
        const qty = Number(line.quantity || 0);
        const lineTotal = Number(line.lineTotal || 0);
        const costPrice = Number(line.productVariant?.costPrice || 0);
        const lineCogs = qty * costPrice;

        const current = map.get(variantId) || {
          productId: line.productVariant?.productId || '',
          variantId,
          name: line.productName || line.productVariant?.product?.name || 'Unknown Product',
          sku: line.sku || line.productVariant?.sku || 'UNKNOWN',
          categoryName: line.productVariant?.product?.category?.name,
          unitsSold: 0,
          revenue: 0,
          cogs: 0,
        };

        current.unitsSold += qty;
        current.revenue += lineTotal;
        current.cogs += lineCogs;
        map.set(variantId, current);
      }
    }

    const items: TopProductDto[] = [];
    for (const item of map.values()) {
      const margin = item.revenue - item.cogs;
      const marginPct = item.revenue > 0 ? (margin / item.revenue) * 100 : 0;
      items.push({
        ...item,
        revenue: Number(item.revenue.toFixed(2)),
        cogs: Number(item.cogs.toFixed(2)),
        margin: Number(margin.toFixed(2)),
        marginPct: Number(marginPct.toFixed(2)),
      });
    }

    return items.sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }

  /**
   * Computes inventory valuation and stockout risks.
   */
  computeInventoryHealth(items: any[]): InventoryHealthDto {
    let totalUnitsOnHand = 0;
    let totalAssetCostValue = 0;
    let totalPotentialRetailValue = 0;
    let lowStockItemCount = 0;
    let outOfStockCount = 0;

    for (const item of items) {
      const stock = Number(item.stockOnHand || 0);
      const reorderPoint = item.reorderPoint !== null ? Number(item.reorderPoint) : Number(item.minimumStock || 0);
      const costPrice = Number(item.productVariant?.costPrice || 0);
      const sellPrice = Number(item.productVariant?.sellPrice || 0);

      totalUnitsOnHand += stock;
      totalAssetCostValue += stock * costPrice;
      totalPotentialRetailValue += stock * sellPrice;

      if (stock <= 0) {
        outOfStockCount += 1;
      } else if (stock <= reorderPoint) {
        lowStockItemCount += 1;
      }
    }

    return {
      totalSkuCount: items.length,
      totalUnitsOnHand: Number(totalUnitsOnHand.toFixed(2)),
      totalAssetCostValue: Number(totalAssetCostValue.toFixed(2)),
      totalPotentialRetailValue: Number(totalPotentialRetailValue.toFixed(2)),
      lowStockItemCount,
      outOfStockCount,
    };
  }

  /**
   * Calculates sales performance per branch location.
   */
  computeBranchPerformance(sales: any[]): BranchPerformanceDto[] {
    const map = new Map<string, { locationName: string; revenue: number; orderCount: number }>();

    for (const sale of sales) {
      const locationId = sale.locationId || 'UNASSIGNED';
      const locationName = sale.location?.name || 'Headquarters / Global';
      const grandTotal = Number(sale.grandTotal || 0);

      const current = map.get(locationId) || { locationName, revenue: 0, orderCount: 0 };
      current.revenue += grandTotal;
      current.orderCount += 1;
      map.set(locationId, current);
    }

    const branches: BranchPerformanceDto[] = [];
    for (const [locationId, data] of map.entries()) {
      const aov = data.orderCount > 0 ? data.revenue / data.orderCount : 0;
      branches.push({
        locationId,
        locationName: data.locationName,
        revenue: Number(data.revenue.toFixed(2)),
        orderCount: data.orderCount,
        aov: Number(aov.toFixed(2)),
      });
    }

    return branches.sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Generates CSV export for reports.
   */
  async generateExportCsv(orgId: string, query: ExportReportDto): Promise<string> {
    const dateFilter = this.buildDateFilter(query.startDate, query.endDate);
    const locationFilter = query.locationId ? { locationId: query.locationId } : {};

    if (query.type === 'SALES') {
      const sales = await this.prisma.sale.findMany({
        where: {
          organizationId: orgId,
          status: 'COMPLETED',
          ...locationFilter,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        include: { location: true, payments: true },
        orderBy: { createdAt: 'desc' },
      });

      const header = 'Sale Number,Date,Status,Branch,Channel,Subtotal,Discount,Tax,Grand Total,Currency,Payment Methods\n';
      const rows = sales.map((s) => {
        const methods = s.payments.map((p) => p.method).join(';');
        const dateStr = new Date(s.createdAt).toISOString();
        return `"${s.saleNumber}","${dateStr}","${s.status}","${s.location?.name || 'HQ'}","${s.channel}",${s.subtotal},${s.discountTotal},${s.taxTotal},${s.grandTotal},"${s.currency}","${methods}"`;
      });

      return header + rows.join('\n');
    }

    if (query.type === 'INVENTORY') {
      const items = await this.prisma.inventoryItem.findMany({
        where: {
          organizationId: orgId,
          ...locationFilter,
        },
        include: {
          productVariant: { include: { product: true } },
          organization: true,
        },
        orderBy: { stockOnHand: 'asc' },
      });

      const header = 'SKU,Product Name,Variant Name,Stock On Hand,Reserved,Unit,Cost Price,Sell Price,Asset Cost Valuation,Potential Retail Valuation,Low Stock\n';
      const rows = items.map((i) => {
        const stock = Number(i.stockOnHand || 0);
        const cost = Number(i.productVariant?.costPrice || 0);
        const sell = Number(i.productVariant?.sellPrice || 0);
        const reorder = i.reorderPoint !== null ? Number(i.reorderPoint) : Number(i.minimumStock || 0);
        const isLow = stock <= reorder ? 'YES' : 'NO';
        return `"${i.productVariant?.sku || ''}","${i.productVariant?.product?.name || ''}","${i.productVariant?.name || ''}",${stock},${i.reservedQty},"${i.productVariant?.unit || 'piece'}",${cost},${sell},${(stock * cost).toFixed(2)},${(stock * sell).toFixed(2)},"${isLow}"`;
      });

      return header + rows.join('\n');
    }

    // Default PRODUCTS top ranking export
    const summary = await this.getExecutiveSummary(orgId, {
      startDate: query.startDate,
      endDate: query.endDate,
      locationId: query.locationId,
    });

    const header = 'SKU,Product Name,Category,Units Sold,Gross Revenue,COGS,Gross Margin,Margin %\n';
    const rows = summary.topProducts.map((p) => {
      return `"${p.sku}","${p.name}","${p.categoryName || ''}",${p.unitsSold},${p.revenue},${p.cogs},${p.margin},${p.marginPct}%`;
    });

    return header + rows.join('\n');
  }
}
