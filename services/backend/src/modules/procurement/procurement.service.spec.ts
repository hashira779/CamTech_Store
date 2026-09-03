import { ProcurementService } from './procurement.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('ProcurementService', () => {
  let service: ProcurementService;
  let prisma: any;
  let audit: any;

  beforeEach(() => {
    prisma = {
      supplier: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      location: {
        findFirst: jest.fn(),
      },
      productVariant: {
        findMany: jest.fn(),
      },
      purchaseOrder: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      goodsReceipt: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
      inventoryItem: {
        upsert: jest.fn(),
      },
      stockMovement: {
        create: jest.fn(),
      },
      purchaseOrderLineItem: {
        update: jest.fn(),
      },
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    service = new ProcurementService(prisma as PrismaService, audit as AuditService);
  });

  describe('createSupplier', () => {
    it('creates a new supplier with audit log', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);
      prisma.supplier.create.mockResolvedValue({
        id: 'sup-1',
        organizationId: 'org-1',
        name: 'Beverage Vendor',
        code: 'SUP-001',
        contactPerson: 'Alice',
        email: 'alice@vendor.com',
        phone: '+12345678',
        taxId: null,
        address: null,
        paymentTerms: 'NET_30',
        notes: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.createSupplier(
        'org-1',
        { name: 'Beverage Vendor', code: 'SUP-001', paymentTerms: 'NET_30' },
        'user-1',
      );

      expect(res.id).toBe('sup-1');
      expect(res.name).toBe('Beverage Vendor');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUPPLIER_CREATED', resourceId: 'sup-1' }),
      );
    });
  });

  describe('createPO', () => {
    it('creates purchase order with calculated totals and PO number', async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: 'sup-1' });
      prisma.location.findFirst.mockResolvedValue({ id: 'loc-1' });
      prisma.productVariant.findMany.mockResolvedValue([{ id: 'var-1' }]);
      prisma.purchaseOrder.count.mockResolvedValue(0);

      const date = new Date();
      prisma.purchaseOrder.create.mockResolvedValue({
        id: 'po-1',
        organizationId: 'org-1',
        locationId: 'loc-1',
        supplierId: 'sup-1',
        poNumber: 'PO-2026-0001',
        orderDate: date,
        expectedDeliveryDate: null,
        status: 'DRAFT',
        currency: 'USD',
        subtotal: new Decimal(500),
        taxTotal: new Decimal(50),
        grandTotal: new Decimal(550),
        notes: null,
        createdAt: date,
        updatedAt: date,
        supplier: { id: 'sup-1', name: 'Beverage Vendor', code: 'SUP-001' },
        location: { id: 'loc-1', name: 'Main Branch', code: 'BR-01' },
        lineItems: [
          {
            id: 'line-1',
            purchaseOrderId: 'po-1',
            productVariantId: 'var-1',
            quantity: new Decimal(50),
            receivedQty: new Decimal(0),
            unitCost: new Decimal(10),
            taxRatePct: new Decimal(10),
            taxAmount: new Decimal(50),
            lineTotal: new Decimal(550),
            productVariant: {
              sku: 'COKE-CAN',
              name: 'Can 330ml',
              product: { name: 'Coca Cola' },
            },
          },
        ],
      });

      const res = await service.createPO(
        'org-1',
        {
          supplierId: 'sup-1',
          locationId: 'loc-1',
          lineItems: [{ productVariantId: 'var-1', quantity: 50, unitCost: 10, taxRatePct: 10 }],
        },
        'user-1',
      );

      expect(res.id).toBe('po-1');
      expect(res.grandTotal).toBe(550);
      expect(res.lineItems[0].lineTotal).toBe(550);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PO_CREATED', resourceId: 'po-1' }),
      );
    });
  });

  describe('receiveGoods', () => {
    it('processes goods receipt, updates stock on hand, and writes StockMovement', async () => {
      const date = new Date();
      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        organizationId: 'org-1',
        locationId: 'loc-1',
        supplierId: 'sup-1',
        poNumber: 'PO-2026-0001',
        status: 'APPROVED',
        supplier: { name: 'Vendor A' },
        location: { name: 'Main Warehouse' },
        lineItems: [
          {
            id: 'line-1',
            productVariantId: 'var-1',
            quantity: new Decimal(50),
            receivedQty: new Decimal(0),
            unitCost: new Decimal(10),
          },
        ],
      });

      prisma.goodsReceipt = {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'grn-1',
          organizationId: 'org-1',
          locationId: 'loc-1',
          purchaseOrderId: 'po-1',
          supplierId: 'sup-1',
          grnNumber: 'GRN-2026-0001',
          receivedDate: date,
          status: 'COMPLETED',
          notes: null,
          createdAt: date,
          lineItems: [
            {
              id: 'grn-line-1',
              goodsReceiptId: 'grn-1',
              poLineItemId: 'line-1',
              productVariantId: 'var-1',
              quantityReceived: new Decimal(50),
              unitCost: new Decimal(10),
              productVariant: {
                sku: 'COKE-CAN',
                product: { name: 'Coca Cola' },
              },
            },
          ],
        }),
      };

      prisma.inventoryItem.upsert.mockResolvedValue({
        id: 'inv-item-1',
        stockOnHand: new Decimal(50),
      });

      const res = await service.receiveGoods(
        'org-1',
        'po-1',
        {
          lineItems: [{ poLineItemId: 'line-1', productVariantId: 'var-1', quantityReceived: 50 }],
        },
        'user-1',
      );

      expect(res.id).toBe('grn-1');
      expect(res.grnNumber).toBe('GRN-2026-0001');
      expect(prisma.inventoryItem.upsert).toHaveBeenCalled();
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'PURCHASE_RECEIPT',
            referenceType: 'GoodsReceipt',
            quantity: new Decimal(50),
          }),
        }),
      );
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'po-1' },
          data: { status: 'COMPLETED' },
        }),
      );
    });

    it('rejects receipt if PO is not in approved or partially received status', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        organizationId: 'org-1',
        status: 'DRAFT',
        lineItems: [],
      });

      await expect(
        service.receiveGoods(
          'org-1',
          'po-1',
          { lineItems: [{ poLineItemId: 'line-1', productVariantId: 'var-1', quantityReceived: 10 }] },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
