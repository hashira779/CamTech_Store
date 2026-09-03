import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PurchaseOrderEntity } from './domain/purchase-order.entity';
import { Decimal } from '@prisma/client/runtime/library';
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierDto,
  CreatePurchaseOrderInput,
  PurchaseOrderDto,
  PurchaseOrderSummaryDto,
  CreateGoodsReceiptInput,
  GoodsReceiptDto,
  Paginated,
} from '@mystore/contracts';

@Injectable()
export class ProcurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── Suppliers ──────────────────────────────────────────────────

  async createSupplier(orgId: string, input: CreateSupplierInput, actorId: string): Promise<SupplierDto> {
    if (input.code) {
      const existing = await this.prisma.supplier.findFirst({
        where: { organizationId: orgId, code: input.code },
      });
      if (existing) {
        throw new ConflictException(`Supplier with code "${input.code}" already exists`);
      }
    }

    const supplier = await this.prisma.supplier.create({
      data: {
        organizationId: orgId,
        code: input.code ? input.code.trim() : null,
        name: input.name.trim(),
        contactPerson: input.contactPerson ? input.contactPerson.trim() : null,
        email: input.email ? input.email.trim() : null,
        phone: input.phone ? input.phone.trim() : null,
        taxId: input.taxId ? input.taxId.trim() : null,
        address: input.address ? input.address.trim() : null,
        paymentTerms: input.paymentTerms,
        notes: input.notes ? input.notes.trim() : null,
        isActive: input.isActive ?? true,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'SUPPLIER_CREATED',
      resourceType: 'Supplier',
      resourceId: supplier.id,
      metadata: { name: supplier.name, code: supplier.code },
    });

    return this.mapSupplierToDto(supplier);
  }

  async listSuppliers(
    orgId: string,
    query: { page: number; limit: number; search?: string },
  ): Promise<Paginated<SupplierDto>> {
    const where: any = { organizationId: orgId };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { contactPerson: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          _count: { select: { purchaseOrders: true } },
        },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / query.limit));

    return {
      items: items.map((s) => this.mapSupplierToDto(s)),
      meta: { page: query.page, limit: query.limit, total, totalPages },
    };
  }

  async updateSupplier(orgId: string, id: string, input: UpdateSupplierInput, actorId: string): Promise<SupplierDto> {
    const existing = await this.prisma.supplier.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) {
      throw new NotFoundException(`Supplier ${id} not found`);
    }

    if (input.code && input.code !== existing.code) {
      const conflict = await this.prisma.supplier.findFirst({
        where: { organizationId: orgId, code: input.code, id: { not: id } },
      });
      if (conflict) {
        throw new ConflictException(`Supplier with code "${input.code}" already exists`);
      }
    }

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        name: input.name ? input.name.trim() : undefined,
        code: input.code !== undefined ? (input.code ? input.code.trim() : null) : undefined,
        contactPerson: input.contactPerson !== undefined ? input.contactPerson : undefined,
        email: input.email !== undefined ? input.email : undefined,
        phone: input.phone !== undefined ? input.phone : undefined,
        taxId: input.taxId !== undefined ? input.taxId : undefined,
        address: input.address !== undefined ? input.address : undefined,
        paymentTerms: input.paymentTerms,
        notes: input.notes !== undefined ? input.notes : undefined,
        isActive: input.isActive !== undefined ? input.isActive : undefined,
      },
      include: {
        _count: { select: { purchaseOrders: true } },
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'SUPPLIER_UPDATED',
      resourceType: 'Supplier',
      resourceId: id,
      metadata: { changes: input },
    });

    return this.mapSupplierToDto(updated);
  }

  // ─── Purchase Orders ────────────────────────────────────────────

  async createPO(orgId: string, input: CreatePurchaseOrderInput, actorId: string): Promise<PurchaseOrderDto> {
    const [supplier, location] = await Promise.all([
      this.prisma.supplier.findFirst({ where: { id: input.supplierId, organizationId: orgId } }),
      this.prisma.location.findFirst({ where: { id: input.locationId, organizationId: orgId } }),
    ]);

    if (!supplier) throw new NotFoundException(`Supplier ${input.supplierId} not found`);
    if (!location) throw new NotFoundException(`Destination location ${input.locationId} not found`);

    // Verify variants
    const variantIds = input.lineItems.map((l) => l.productVariantId);
    const variants = await this.prisma.productVariant.findMany({
      where: { organizationId: orgId, id: { in: variantIds } },
    });

    if (variants.length !== variantIds.length) {
      throw new BadRequestException('One or more product variants were not found in this organization');
    }

    // Compute lines & totals
    const calc = PurchaseOrderEntity.calculateLines(input.lineItems);

    // Auto-sequence PO number
    const year = new Date().getFullYear();
    const count = await this.prisma.purchaseOrder.count({
      where: { organizationId: orgId },
    });
    const poNumber = `PO-${year}-${String(count + 1).padStart(4, '0')}`;

    const po = await this.prisma.purchaseOrder.create({
      data: {
        organizationId: orgId,
        locationId: input.locationId,
        supplierId: input.supplierId,
        poNumber,
        currency: input.currency ?? 'USD',
        expectedDeliveryDate: input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : null,
        notes: input.notes,
        subtotal: new Decimal(calc.subtotal),
        taxTotal: new Decimal(calc.taxTotal),
        grandTotal: new Decimal(calc.grandTotal),
        lineItems: {
          create: calc.lines.map((l) => ({
            productVariantId: l.productVariantId,
            quantity: new Decimal(l.quantity),
            unitCost: new Decimal(l.unitCost),
            taxRatePct: new Decimal(l.taxRatePct),
            taxAmount: new Decimal(l.taxAmount),
            lineTotal: new Decimal(l.lineTotal),
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        location: { select: { id: true, name: true, code: true } },
        lineItems: {
          include: {
            productVariant: {
              select: {
                sku: true,
                name: true,
                product: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'PO_CREATED',
      resourceType: 'PurchaseOrder',
      resourceId: po.id,
      metadata: { poNumber: po.poNumber, grandTotal: calc.grandTotal },
    });

    return this.mapPOToDto(po);
  }

  async listPOs(
    orgId: string,
    query: { page: number; limit: number; status?: string; supplierId?: string; locationId?: string; search?: string },
  ): Promise<Paginated<PurchaseOrderSummaryDto>> {
    const where: any = { organizationId: orgId };
    if (query.status) where.status = query.status;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.search) {
      where.OR = [
        { poNumber: { contains: query.search, mode: 'insensitive' } },
        { supplier: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          supplier: { select: { name: true } },
          location: { select: { name: true } },
          _count: { select: { lineItems: true } },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / query.limit));

    return {
      items: items.map((po) => ({
        id: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplier.name,
        locationName: po.location.name,
        status: po.status as any,
        grandTotal: Number(po.grandTotal),
        currency: po.currency,
        orderDate: po.orderDate.toISOString(),
        itemCount: po._count.lineItems,
        expectedDeliveryDate: po.expectedDeliveryDate ? po.expectedDeliveryDate.toISOString() : null,
      })),
      meta: { page: query.page, limit: query.limit, total, totalPages },
    };
  }

  async getPOById(orgId: string, id: string): Promise<PurchaseOrderDto> {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, organizationId: orgId },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        location: { select: { id: true, name: true, code: true } },
        lineItems: {
          include: {
            productVariant: {
              select: {
                sku: true,
                name: true,
                product: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!po) throw new NotFoundException(`Purchase order ${id} not found`);

    return this.mapPOToDto(po);
  }

  async approvePO(orgId: string, id: string, actorId: string): Promise<PurchaseOrderDto> {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!po) throw new NotFoundException(`Purchase order ${id} not found`);

    PurchaseOrderEntity.validateTransition(po.status as any, 'APPROVED');

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        location: { select: { id: true, name: true, code: true } },
        lineItems: {
          include: {
            productVariant: {
              select: {
                sku: true,
                name: true,
                product: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'PO_APPROVED',
      resourceType: 'PurchaseOrder',
      resourceId: id,
      metadata: { poNumber: po.poNumber },
    });

    return this.mapPOToDto(updated);
  }

  async cancelPO(orgId: string, id: string, actorId: string): Promise<PurchaseOrderDto> {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!po) throw new NotFoundException(`Purchase order ${id} not found`);

    PurchaseOrderEntity.validateTransition(po.status as any, 'CANCELLED');

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        location: { select: { id: true, name: true, code: true } },
        lineItems: {
          include: {
            productVariant: {
              select: {
                sku: true,
                name: true,
                product: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'PO_CANCELLED',
      resourceType: 'PurchaseOrder',
      resourceId: id,
      metadata: { poNumber: po.poNumber },
    });

    return this.mapPOToDto(updated);
  }

  // ─── Goods Receipt Notes (GRN) & Stock Inbound ──────────────────

  async receiveGoods(
    orgId: string,
    poId: string,
    input: CreateGoodsReceiptInput,
    actorId: string,
  ): Promise<GoodsReceiptDto> {
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id: poId, organizationId: orgId },
        include: {
          lineItems: true,
          supplier: true,
          location: true,
        },
      });

      if (!po) throw new NotFoundException(`Purchase order ${poId} not found`);

      if (po.status !== 'APPROVED' && po.status !== 'PARTIALLY_RECEIVED') {
        throw new BadRequestException(
          `Cannot receive goods for purchase order in status ${po.status}. Must be APPROVED or PARTIALLY_RECEIVED.`,
        );
      }

      // Build line lookup and compute next status
      const lineMap = new Map<string, { quantity: number; receivedQty: number }>();
      const lineDataMap = new Map<string, (typeof po.lineItems)[0]>();
      for (const line of po.lineItems) {
        lineMap.set(line.id, {
          quantity: Number(line.quantity),
          receivedQty: Number(line.receivedQty),
        });
        lineDataMap.set(line.id, line);
      }

      const nextPoStatus = PurchaseOrderEntity.computeNextReceiptStatus(
        po.lineItems.map((l) => ({ id: l.id, quantity: Number(l.quantity), receivedQty: Number(l.receivedQty) })),
        input.lineItems,
        lineMap,
      );

      // Auto-sequence GRN number
      const year = new Date().getFullYear();
      const grnCount = await tx.goodsReceipt.count({ where: { organizationId: orgId } });
      const grnNumber = `GRN-${year}-${String(grnCount + 1).padStart(4, '0')}`;

      // Create GRN
      const grn = await tx.goodsReceipt.create({
        data: {
          organizationId: orgId,
          locationId: po.locationId,
          purchaseOrderId: po.id,
          supplierId: po.supplierId,
          grnNumber,
          notes: input.notes,
          status: 'COMPLETED',
          lineItems: {
            create: input.lineItems.map((item) => {
              const poLine = lineDataMap.get(item.poLineItemId)!;
              return {
                poLineItemId: item.poLineItemId,
                productVariantId: item.productVariantId,
                quantityReceived: new Decimal(item.quantityReceived),
                unitCost: poLine.unitCost,
              };
            }),
          },
        },
        include: {
          lineItems: {
            include: {
              productVariant: {
                select: {
                  sku: true,
                  product: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      // Update PO line received quantities & Stock Inbound
      for (const item of input.lineItems) {
        const qty = new Decimal(item.quantityReceived);

        // Update PO Line
        await tx.purchaseOrderLineItem.update({
          where: { id: item.poLineItemId },
          data: { receivedQty: { increment: qty } },
        });

        // Upsert InventoryItem at location
        const inventoryItem = await tx.inventoryItem.upsert({
          where: {
            organizationId_productVariantId_locationId: {
              organizationId: orgId,
              productVariantId: item.productVariantId,
              locationId: po.locationId,
            },
          },
          create: {
            organizationId: orgId,
            productVariantId: item.productVariantId,
            locationId: po.locationId,
            stockOnHand: qty,
          },
          update: {
            stockOnHand: { increment: qty },
          },
        });

        // Insert StockMovement ledger entry
        await tx.stockMovement.create({
          data: {
            organizationId: orgId,
            inventoryItemId: inventoryItem.id,
            type: 'PURCHASE_RECEIPT',
            quantity: qty,
            balanceAfter: inventoryItem.stockOnHand,
            referenceType: 'GoodsReceipt',
            referenceId: grn.id,
            notes: input.notes ?? `Received on ${grn.grnNumber}`,
            userId: actorId,
          },
        });
      }

      // Update PO status
      await tx.purchaseOrder.update({
        where: { id: poId },
        data: { status: nextPoStatus },
      });

      await this.audit.record({
        organizationId: orgId,
        actorId,
        action: 'GOODS_RECEIVED',
        resourceType: 'GoodsReceipt',
        resourceId: grn.id,
        metadata: { grnNumber: grn.grnNumber, poNumber: po.poNumber, newPoStatus: nextPoStatus },
      });

      return {
        id: grn.id,
        organizationId: grn.organizationId,
        locationId: grn.locationId,
        purchaseOrderId: grn.purchaseOrderId,
        supplierId: grn.supplierId,
        grnNumber: grn.grnNumber,
        receivedDate: grn.receivedDate.toISOString(),
        status: grn.status as any,
        notes: grn.notes,
        createdAt: grn.createdAt.toISOString(),
        supplierName: po.supplier.name,
        locationName: po.location.name,
        poNumber: po.poNumber,
        lineItems: grn.lineItems.map((l) => ({
          id: l.id,
          goodsReceiptId: l.goodsReceiptId,
          poLineItemId: l.poLineItemId,
          productVariantId: l.productVariantId,
          productName: l.productVariant.product.name,
          sku: l.productVariant.sku,
          quantityReceived: Number(l.quantityReceived),
          unitCost: Number(l.unitCost),
        })),
      };
    });
  }

  async listGoodsReceipts(
    orgId: string,
    query: { page: number; limit: number; poId?: string },
  ): Promise<Paginated<GoodsReceiptDto>> {
    const where: any = { organizationId: orgId };
    if (query.poId) where.purchaseOrderId = query.poId;

    const [items, total] = await Promise.all([
      this.prisma.goodsReceipt.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          supplier: { select: { name: true } },
          location: { select: { name: true } },
          purchaseOrder: { select: { poNumber: true } },
          lineItems: {
            include: {
              productVariant: {
                select: {
                  sku: true,
                  product: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.goodsReceipt.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / query.limit));

    return {
      items: items.map((grn) => ({
        id: grn.id,
        organizationId: grn.organizationId,
        locationId: grn.locationId,
        purchaseOrderId: grn.purchaseOrderId,
        supplierId: grn.supplierId,
        grnNumber: grn.grnNumber,
        receivedDate: grn.receivedDate.toISOString(),
        status: grn.status as any,
        notes: grn.notes,
        createdAt: grn.createdAt.toISOString(),
        supplierName: grn.supplier.name,
        locationName: grn.location.name,
        poNumber: grn.purchaseOrder.poNumber,
        lineItems: grn.lineItems.map((l) => ({
          id: l.id,
          goodsReceiptId: l.goodsReceiptId,
          poLineItemId: l.poLineItemId,
          productVariantId: l.productVariantId,
          productName: l.productVariant.product.name,
          sku: l.productVariant.sku,
          quantityReceived: Number(l.quantityReceived),
          unitCost: Number(l.unitCost),
        })),
      })),
      meta: { page: query.page, limit: query.limit, total, totalPages },
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private mapSupplierToDto(s: any): SupplierDto {
    return {
      id: s.id,
      organizationId: s.organizationId,
      code: s.code,
      name: s.name,
      contactPerson: s.contactPerson,
      email: s.email,
      phone: s.phone,
      taxId: s.taxId,
      address: s.address,
      paymentTerms: s.paymentTerms,
      notes: s.notes,
      isActive: s.isActive,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      _count: s._count,
    };
  }

  private mapPOToDto(po: any): PurchaseOrderDto {
    return {
      id: po.id,
      organizationId: po.organizationId,
      locationId: po.locationId,
      supplierId: po.supplierId,
      poNumber: po.poNumber,
      orderDate: po.orderDate.toISOString(),
      expectedDeliveryDate: po.expectedDeliveryDate ? po.expectedDeliveryDate.toISOString() : null,
      status: po.status,
      currency: po.currency,
      subtotal: Number(po.subtotal),
      taxTotal: Number(po.taxTotal),
      grandTotal: Number(po.grandTotal),
      notes: po.notes,
      createdAt: po.createdAt.toISOString(),
      updatedAt: po.updatedAt.toISOString(),
      supplier: po.supplier,
      location: po.location,
      lineItems: po.lineItems.map((l: any) => ({
        id: l.id,
        purchaseOrderId: l.purchaseOrderId,
        productVariantId: l.productVariantId,
        sku: l.productVariant.sku,
        productName: l.productVariant.product.name,
        variantName: l.productVariant.name,
        quantity: Number(l.quantity),
        receivedQty: Number(l.receivedQty),
        unitCost: Number(l.unitCost),
        taxRatePct: Number(l.taxRatePct),
        taxAmount: Number(l.taxAmount),
        lineTotal: Number(l.lineTotal),
      })),
    };
  }
}
