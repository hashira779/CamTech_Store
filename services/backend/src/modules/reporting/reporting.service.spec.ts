import { ReportingService } from './reporting.service';

describe('ReportingService', () => {
  let service: ReportingService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      sale: {
        findMany: jest.fn(),
      },
      inventoryItem: {
        findMany: jest.fn(),
      },
    };
    service = new ReportingService(mockPrisma);
  });

  describe('computeSalesSummary', () => {
    it('calculates gross revenue, COGS, margins, and AOV accurately', () => {
      const mockSales = [
        {
          subtotal: 100,
          discountTotal: 10,
          taxTotal: 10,
          grandTotal: 100, // 100 - 10 + 10
          lineItems: [
            {
              quantity: 2,
              lineTotal: 60,
              productVariant: { costPrice: 15 }, // COGS: 2 * 15 = 30
            },
            {
              quantity: 1,
              lineTotal: 40,
              productVariant: { costPrice: 20 }, // COGS: 1 * 20 = 20
            },
          ],
        },
        {
          subtotal: 200,
          discountTotal: 0,
          taxTotal: 20,
          grandTotal: 220,
          lineItems: [
            {
              quantity: 5,
              lineTotal: 200,
              productVariant: { costPrice: 25 }, // COGS: 5 * 25 = 125
            },
          ],
        },
      ];

      const summary = service.computeSalesSummary(mockSales);

      // Sale 1: subtotal 100 + tax 10 = 110 gross, Sale 2: subtotal 200 + tax 20 = 220 gross -> total 330
      expect(summary.grossRevenue).toBe(330);
      expect(summary.discountTotal).toBe(10);
      // Net: 100 + 220 = 320
      expect(summary.netRevenue).toBe(320);
      expect(summary.taxTotal).toBe(30);
      // Total COGS = 30 + 20 + 125 = 175
      expect(summary.cogs).toBe(175);
      // Margin = 320 - 175 = 145
      expect(summary.grossMargin).toBe(145);
      // Margin % = (145 / 320) * 100 = 45.3125 -> 45.31
      expect(summary.grossMarginPct).toBe(45.31);
      expect(summary.orderCount).toBe(2);
      expect(summary.averageOrderValue).toBe(160);
    });

    it('handles empty sales dataset safely with zero margins', () => {
      const summary = service.computeSalesSummary([]);
      expect(summary.grossRevenue).toBe(0);
      expect(summary.netRevenue).toBe(0);
      expect(summary.cogs).toBe(0);
      expect(summary.grossMargin).toBe(0);
      expect(summary.grossMarginPct).toBe(0);
      expect(summary.orderCount).toBe(0);
      expect(summary.averageOrderValue).toBe(0);
    });
  });

  describe('computePaymentBreakdown', () => {
    it('aggregates payment volume and percentage per method', () => {
      const mockSales = [
        {
          payments: [
            { method: 'CASH', amount: 50 },
            { method: 'KHQR', amount: 50 },
          ],
        },
        {
          payments: [
            { method: 'KHQR', amount: 100 },
          ],
        },
      ];

      const breakdown = service.computePaymentBreakdown(mockSales);

      expect(breakdown).toHaveLength(2);
      // KHQR: total 150 (75%)
      expect(breakdown[0].method).toBe('KHQR');
      expect(breakdown[0].count).toBe(2);
      expect(breakdown[0].totalAmount).toBe(150);
      expect(breakdown[0].percentage).toBe(75);

      // CASH: total 50 (25%)
      expect(breakdown[1].method).toBe('CASH');
      expect(breakdown[1].count).toBe(1);
      expect(breakdown[1].totalAmount).toBe(50);
      expect(breakdown[1].percentage).toBe(25);
    });
  });

  describe('computeTopProducts', () => {
    it('ranks products by revenue and computes gross margins', () => {
      const mockSales = [
        {
          lineItems: [
            {
              productVariantId: 'v1',
              sku: 'COFFEE-001',
              productName: 'Espresso Roast',
              quantity: 10,
              lineTotal: 100,
              productVariant: { costPrice: 4 }, // COGS: 40, margin: 60
            },
            {
              productVariantId: 'v2',
              sku: 'MUG-001',
              productName: 'Ceramic Mug',
              quantity: 2,
              lineTotal: 40,
              productVariant: { costPrice: 10 }, // COGS: 20, margin: 20
            },
          ],
        },
        {
          lineItems: [
            {
              productVariantId: 'v1',
              sku: 'COFFEE-001',
              productName: 'Espresso Roast',
              quantity: 5,
              lineTotal: 50,
              productVariant: { costPrice: 4 }, // COGS: 20, margin: 30
            },
          ],
        },
      ];

      const topProducts = service.computeTopProducts(mockSales);

      expect(topProducts).toHaveLength(2);
      // Top 1: COFFEE-001 (15 units, 150 rev, 60 cogs, 90 margin, 60% margin)
      expect(topProducts[0].sku).toBe('COFFEE-001');
      expect(topProducts[0].unitsSold).toBe(15);
      expect(topProducts[0].revenue).toBe(150);
      expect(topProducts[0].cogs).toBe(60);
      expect(topProducts[0].margin).toBe(90);
      expect(topProducts[0].marginPct).toBe(60);

      // Top 2: MUG-001
      expect(topProducts[1].sku).toBe('MUG-001');
      expect(topProducts[1].unitsSold).toBe(2);
      expect(topProducts[1].revenue).toBe(40);
      expect(topProducts[1].margin).toBe(20);
      expect(topProducts[1].marginPct).toBe(50);
    });
  });

  describe('computeInventoryHealth', () => {
    it('calculates inventory valuation, low stock and stockout counts', () => {
      const mockItems = [
        {
          stockOnHand: 100,
          reorderPoint: 20,
          productVariant: { costPrice: 10, sellPrice: 20 },
        },
        {
          stockOnHand: 15,
          reorderPoint: 20, // low stock
          productVariant: { costPrice: 5, sellPrice: 15 },
        },
        {
          stockOnHand: 0, // out of stock
          reorderPoint: 10,
          productVariant: { costPrice: 30, sellPrice: 50 },
        },
      ];

      const health = service.computeInventoryHealth(mockItems);

      expect(health.totalSkuCount).toBe(3);
      expect(health.totalUnitsOnHand).toBe(115);
      // Asset cost: (100 * 10) + (15 * 5) + (0 * 30) = 1000 + 75 = 1075
      expect(health.totalAssetCostValue).toBe(1075);
      // Retail: (100 * 20) + (15 * 15) = 2000 + 225 = 2225
      expect(health.totalPotentialRetailValue).toBe(2225);
      expect(health.lowStockItemCount).toBe(1);
      expect(health.outOfStockCount).toBe(1);
    });
  });

  describe('generateExportCsv', () => {
    it('generates properly formatted CSV for sales', async () => {
      mockPrisma.sale.findMany.mockResolvedValue([
        {
          saleNumber: 'S-2026-0001',
          createdAt: new Date('2026-09-01T12:00:00Z'),
          status: 'COMPLETED',
          location: { name: 'Main Cafe' },
          channel: 'POS',
          subtotal: 100,
          discountTotal: 10,
          taxTotal: 10,
          grandTotal: 100,
          currency: 'USD',
          payments: [{ method: 'CASH' }, { method: 'KHQR' }],
        },
      ]);

      const csv = await service.generateExportCsv('org_1', { type: 'SALES' });

      expect(csv).toContain('Sale Number,Date,Status,Branch,Channel,Subtotal,Discount,Tax,Grand Total,Currency,Payment Methods');
      expect(csv).toContain('"S-2026-0001"');
      expect(csv).toContain('"Main Cafe"');
      expect(csv).toContain('CASH;KHQR');
    });
  });
});
