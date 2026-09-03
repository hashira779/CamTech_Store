import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Decimal } from '@prisma/client/runtime/library';
import { StockTransferEntity } from './domain/stock-transfer.entity';
import type {
  CreateWarehouseZoneInput,
  CreateWarehouseBinInput,
  CreateProductBatchInput,
  CreateStockTransferInput,
  ReceiveStockTransferInput,
  StockTransferStatus,
  StockTransferDto,
  WarehouseZoneDto,
  WarehouseBinDto,
  ProductBatchDto,
} from '@mystore/contracts';

@Injectable()
export class WmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Warehouse Zones & Bins
  // ---------------------------------------------------------------------------

  async createZone(
    orgId: string,
    actorId: string,
    input: CreateWarehouseZoneInput,
  ): Promise<WarehouseZoneDto> {
    const location = await this.prisma.location.findFirst({
      where: { id: input.locationId, organizationId: orgId },
    });
    if (!location) throw new NotFoundException(`Location ${input.locationId} not found`);

    const existing = await this.prisma.warehouseZone.findUnique({
      where: { locationId_code: { locationId: input.locationId, code: input.code } },
    });
    if (existing) {
      throw new ConflictException(`Zone with code '${input.code}' already exists at this location`);
    }

    const zone = await this.prisma.warehouseZone.create({
      data: {
        locationId: input.locationId,
        code: input.code,
        name: input.name,
        type: input.type as any,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'WAREHOUSE_ZONE_CREATED',
      resourceType: 'WarehouseZone',
      resourceId: zone.id,
      metadata: { code: zone.code, locationId: zone.locationId },
    });

    return {
      id: zone.id,
      locationId: zone.locationId,
      code: zone.code,
      name: zone.name,
      type: zone.type as any,
      isActive: zone.isActive,
      createdAt: zone.createdAt.toISOString(),
    };
  }

  async listZones(orgId: string, locationId?: string): Promise<WarehouseZoneDto[]> {
    const zones = await this.prisma.warehouseZone.findMany({
      where: {
        location: { organizationId: orgId },
        ...(locationId ? { locationId } : {}),
      },
      include: { bins: true },
      orderBy: { code: 'asc' },
    });

    return zones.map((z) => ({
      id: z.id,
      locationId: z.locationId,
      code: z.code,
      name: z.name,
      type: z.type as any,
      isActive: z.isActive,
      createdAt: z.createdAt.toISOString(),
      bins: z.bins.map((b) => ({
        id: b.id,
        zoneId: b.zoneId,
        code: b.code,
        barcode: b.barcode,
        maxWeightKg: b.maxWeightKg ? Number(b.maxWeightKg) : null,
        maxVolumeCbm: b.maxVolumeCbm ? Number(b.maxVolumeCbm) : null,
        isActive: b.isActive,
      })),
    }));
  }

  async createBin(
    orgId: string,
    actorId: string,
    input: CreateWarehouseBinInput,
  ): Promise<WarehouseBinDto> {
    const zone = await this.prisma.warehouseZone.findFirst({
      where: { id: input.zoneId, location: { organizationId: orgId } },
    });
    if (!zone) throw new NotFoundException(`WarehouseZone ${input.zoneId} not found`);

    const existing = await this.prisma.warehouseBin.findUnique({
      where: { zoneId_code: { zoneId: input.zoneId, code: input.code } },
    });
    if (existing) {
      throw new ConflictException(`Bin with code '${input.code}' already exists in this zone`);
    }

    const bin = await this.prisma.warehouseBin.create({
      data: {
        zoneId: input.zoneId,
        code: input.code,
        barcode: input.barcode || null,
        maxWeightKg: input.maxWeightKg ? new Decimal(input.maxWeightKg) : null,
        maxVolumeCbm: input.maxVolumeCbm ? new Decimal(input.maxVolumeCbm) : null,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'WAREHOUSE_BIN_CREATED',
      resourceType: 'WarehouseBin',
      resourceId: bin.id,
      metadata: { code: bin.code, zoneId: bin.zoneId },
    });

    return {
      id: bin.id,
      zoneId: bin.zoneId,
      code: bin.code,
      barcode: bin.barcode,
      maxWeightKg: bin.maxWeightKg ? Number(bin.maxWeightKg) : null,
      maxVolumeCbm: bin.maxVolumeCbm ? Number(bin.maxVolumeCbm) : null,
      isActive: bin.isActive,
    };
  }

  // ---------------------------------------------------------------------------
  // Product Batches & Lot Tracking
  // ---------------------------------------------------------------------------

  async createBatch(
    orgId: string,
    actorId: string,
    input: CreateProductBatchInput,
  ): Promise<ProductBatchDto> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: input.productVariantId, organizationId: orgId },
    });
    if (!variant) throw new NotFoundException(`ProductVariant ${input.productVariantId} not found`);

    const existing = await this.prisma.productBatch.findUnique({
      where: {
        organizationId_productVariantId_batchNumber: {
          organizationId: orgId,
          productVariantId: input.productVariantId,
          batchNumber: input.batchNumber,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Batch '${input.batchNumber}' already exists for this variant in the organization`,
      );
    }

    const batch = await this.prisma.productBatch.create({
      data: {
        organizationId: orgId,
        productVariantId: input.productVariantId,
        batchNumber: input.batchNumber,
        lotNumber: input.lotNumber || null,
        manufacturedAt: input.manufacturedAt ? new Date(input.manufacturedAt) : null,
        expiresAt: new Date(input.expiresAt),
        quantityOnHand: new Decimal(input.quantityOnHand || 0),
        costPrice: input.costPrice ? new Decimal(input.costPrice) : null,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'PRODUCT_BATCH_CREATED',
      resourceType: 'ProductBatch',
      resourceId: batch.id,
      metadata: { batchNumber: batch.batchNumber, expiresAt: batch.expiresAt },
    });

    return {
      id: batch.id,
      organizationId: batch.organizationId,
      productVariantId: batch.productVariantId,
      batchNumber: batch.batchNumber,
      lotNumber: batch.lotNumber,
      manufacturedAt: batch.manufacturedAt ? batch.manufacturedAt.toISOString() : null,
      expiresAt: batch.expiresAt.toISOString(),
      quantityOnHand: Number(batch.quantityOnHand),
      costPrice: batch.costPrice ? Number(batch.costPrice) : null,
      isExpired: new Date(batch.expiresAt) <= new Date(),
    };
  }

  async listBatches(orgId: string, variantId?: string): Promise<ProductBatchDto[]> {
    const batches = await this.prisma.productBatch.findMany({
      where: {
        organizationId: orgId,
        ...(variantId ? { productVariantId: variantId } : {}),
      },
      orderBy: { expiresAt: 'asc' },
    });

    const now = new Date();
    return batches.map((b) => ({
      id: b.id,
      organizationId: b.organizationId,
      productVariantId: b.productVariantId,
      batchNumber: b.batchNumber,
      lotNumber: b.lotNumber,
      manufacturedAt: b.manufacturedAt ? b.manufacturedAt.toISOString() : null,
      expiresAt: b.expiresAt.toISOString(),
      quantityOnHand: Number(b.quantityOnHand),
      costPrice: b.costPrice ? Number(b.costPrice) : null,
      isExpired: new Date(b.expiresAt) <= now,
    }));
  }

  // ---------------------------------------------------------------------------
  // Stock Transfers
  // ---------------------------------------------------------------------------

  async listTransfers(
    orgId: string,
    query?: { status?: StockTransferStatus; sourceLocationId?: string; destLocationId?: string },
  ): Promise<StockTransferDto[]> {
    const transfers = await this.prisma.stockTransfer.findMany({
      where: {
        organizationId: orgId,
        ...(query?.status ? { status: query.status } : {}),
        ...(query?.sourceLocationId ? { sourceLocationId: query.sourceLocationId } : {}),
        ...(query?.destLocationId ? { destinationLocationId: query.destLocationId } : {}),
      },
      include: {
        sourceLocation: true,
        destinationLocation: true,
        requestedBy: true,
        lines: {
          include: { productVariant: { include: { product: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return transfers.map((t) => this.mapTransferDto(t));
  }

  async getTransfer(orgId: string, id: string): Promise<StockTransferDto> {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id, organizationId: orgId },
      include: {
        sourceLocation: true,
        destinationLocation: true,
        requestedBy: true,
        lines: {
          include: { productVariant: { include: { product: true } } },
        },
      },
    });
    if (!transfer) throw new NotFoundException(`StockTransfer ${id} not found`);

    return this.mapTransferDto(transfer);
  }

  async createTransfer(
    orgId: string,
    actorId: string,
    input: CreateStockTransferInput,
  ): Promise<StockTransferDto> {
    StockTransferEntity.validateCreation(
      input.sourceLocationId,
      input.destinationLocationId,
      input.lines,
    );

    // Verify source and dest locations belong to org
    const [sourceLoc, destLoc] = await Promise.all([
      this.prisma.location.findFirst({
        where: { id: input.sourceLocationId, organizationId: orgId },
      }),
      this.prisma.location.findFirst({
        where: { id: input.destinationLocationId, organizationId: orgId },
      }),
    ]);
    if (!sourceLoc) throw new NotFoundException(`Source location ${input.sourceLocationId} not found`);
    if (!destLoc) throw new NotFoundException(`Destination location ${input.destinationLocationId} not found`);

    // Verify variants
    const variantIds = input.lines.map((l) => l.productVariantId);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, organizationId: orgId },
    });
    if (variants.length !== variantIds.length) {
      throw new BadRequestException('One or more product variants do not exist in organization');
    }

    // Sequence transfer number
    const count = await this.prisma.stockTransfer.count({ where: { organizationId: orgId } });
    const year = new Date().getFullYear();
    const transferNumber = `TR-${year}-${(count + 1).toString().padStart(6, '0')}`;

    const transfer = await this.prisma.stockTransfer.create({
      data: {
        organizationId: orgId,
        transferNumber,
        sourceLocationId: input.sourceLocationId,
        destinationLocationId: input.destinationLocationId,
        status: 'REQUESTED',
        requestedById: actorId,
        notes: input.notes || null,
        lines: {
          create: input.lines.map((line) => ({
            productVariantId: line.productVariantId,
            requestedQty: new Decimal(line.requestedQty),
            batchNumber: line.batchNumber || null,
            sourceBinId: line.sourceBinId || null,
            destBinId: line.destBinId || null,
          })),
        },
      },
      include: {
        sourceLocation: true,
        destinationLocation: true,
        requestedBy: true,
        lines: {
          include: { productVariant: { include: { product: true } } },
        },
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'STOCK_TRANSFER_CREATED',
      resourceType: 'StockTransfer',
      resourceId: transfer.id,
      metadata: { transferNumber, source: sourceLoc.name, dest: destLoc.name },
    });

    return this.mapTransferDto(transfer);
  }

  async updateStatus(
    orgId: string,
    actorId: string,
    transferId: string,
    targetStatus: StockTransferStatus,
    notes?: string | null,
  ): Promise<StockTransferDto> {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id: transferId, organizationId: orgId },
    });
    if (!transfer) throw new NotFoundException(`StockTransfer ${transferId} not found`);

    StockTransferEntity.validateStatusTransition(transfer.status as any, targetStatus);

    const updated = await this.prisma.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: targetStatus as any,
        notes: notes !== undefined ? notes : transfer.notes,
        ...(targetStatus === 'APPROVED' ? { approvedById: actorId } : {}),
      },
      include: {
        sourceLocation: true,
        destinationLocation: true,
        requestedBy: true,
        lines: {
          include: { productVariant: { include: { product: true } } },
        },
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: `STOCK_TRANSFER_${targetStatus}`,
      resourceType: 'StockTransfer',
      resourceId: updated.id,
      metadata: { from: transfer.status, to: targetStatus },
    });

    return this.mapTransferDto(updated);
  }

  /**
   * Dispatches transfer to transit. Atomically deducts stock from source location.
   */
  async shipTransfer(orgId: string, actorId: string, transferId: string): Promise<StockTransferDto> {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id: transferId, organizationId: orgId },
      include: { lines: true },
    });
    if (!transfer) throw new NotFoundException(`StockTransfer ${transferId} not found`);

    StockTransferEntity.validateStatusTransition(transfer.status as any, 'IN_TRANSIT');

    await this.prisma.$transaction(async (tx) => {
      // 1. Process line items: check and deduct stock from source
      for (const line of transfer.lines) {
        const qtyToSend = Number(line.requestedQty);

        const item = await tx.inventoryItem.findUnique({
          where: {
            organizationId_productVariantId_locationId: {
              organizationId: orgId,
              productVariantId: line.productVariantId,
              locationId: transfer.sourceLocationId,
            },
          },
        });

        const currentStock = item ? Number(item.stockOnHand) : 0;
        if (currentStock < qtyToSend) {
          throw new BadRequestException(
            `Insufficient stock at source location for variant ${line.productVariantId}. Available: ${currentStock}, Requested: ${qtyToSend}`,
          );
        }

        const newStock = currentStock - qtyToSend;

        const updatedItem = await tx.inventoryItem.update({
          where: { id: item!.id },
          data: { stockOnHand: new Decimal(newStock) },
        });

        // Record TRANSFER_OUT movement
        await tx.stockMovement.create({
          data: {
            organizationId: orgId,
            inventoryItemId: updatedItem.id,
            type: 'TRANSFER_OUT',
            quantity: new Decimal(-qtyToSend),
            balanceAfter: new Decimal(newStock),
            referenceType: 'StockTransfer',
            referenceId: transfer.transferNumber,
            notes: `Dispatched to ${transfer.destinationLocationId}`,
            userId: actorId,
          },
        });

        // Update line sentQty
        await tx.stockTransferLine.update({
          where: { id: line.id },
          data: { sentQty: new Decimal(qtyToSend) },
        });
      }

      // 2. Mark transfer as IN_TRANSIT
      await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'IN_TRANSIT',
          shippedById: actorId,
          shippedAt: new Date(),
        },
      });
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'STOCK_TRANSFER_SHIPPED',
      resourceType: 'StockTransfer',
      resourceId: transfer.id,
      metadata: { transferNumber: transfer.transferNumber },
    });

    return this.getTransfer(orgId, transferId);
  }

  /**
   * Receives goods at destination location. Atomically increments stock and records discrepancies.
   */
  async receiveTransfer(
    orgId: string,
    actorId: string,
    transferId: string,
    input: ReceiveStockTransferInput,
  ): Promise<StockTransferDto> {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id: transferId, organizationId: orgId },
      include: { lines: true },
    });
    if (!transfer) throw new NotFoundException(`StockTransfer ${transferId} not found`);

    StockTransferEntity.validateStatusTransition(transfer.status as any, 'RECEIVED');

    await this.prisma.$transaction(async (tx) => {
      for (const receiveLine of input.lines) {
        const line = transfer.lines.find((l) => l.id === receiveLine.lineId);
        if (!line) {
          throw new NotFoundException(`Line ${receiveLine.lineId} not found on this transfer`);
        }

        const receivedQty = receiveLine.receivedQty;

        // Find or create InventoryItem at destination location
        const item = await tx.inventoryItem.upsert({
          where: {
            organizationId_productVariantId_locationId: {
              organizationId: orgId,
              productVariantId: line.productVariantId,
              locationId: transfer.destinationLocationId,
            },
          },
          update: {
            stockOnHand: { increment: new Decimal(receivedQty) },
          },
          create: {
            organizationId: orgId,
            locationId: transfer.destinationLocationId,
            productVariantId: line.productVariantId,
            stockOnHand: new Decimal(receivedQty),
            reservedQty: new Decimal(0),
            minimumStock: new Decimal(0),
          },
        });

        // Record TRANSFER_IN movement
        await tx.stockMovement.create({
          data: {
            organizationId: orgId,
            inventoryItemId: item.id,
            type: 'TRANSFER_IN',
            quantity: new Decimal(receivedQty),
            balanceAfter: item.stockOnHand,
            referenceType: 'StockTransfer',
            referenceId: transfer.transferNumber,
            notes: `Received from ${transfer.sourceLocationId}`,
            userId: actorId,
          },
        });

        // Update line receivedQty and destBin
        await tx.stockTransferLine.update({
          where: { id: line.id },
          data: {
            receivedQty: new Decimal(receivedQty),
            destBinId: receiveLine.destBinId || line.destBinId,
          },
        });
      }

      // Mark transfer as RECEIVED
      await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'RECEIVED',
          receivedById: actorId,
          receivedAt: new Date(),
          notes: input.notes || transfer.notes,
        },
      });
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'STOCK_TRANSFER_RECEIVED',
      resourceType: 'StockTransfer',
      resourceId: transfer.id,
      metadata: { transferNumber: transfer.transferNumber },
    });

    return this.getTransfer(orgId, transferId);
  }

  private mapTransferDto(t: any): StockTransferDto {
    return {
      id: t.id,
      organizationId: t.organizationId,
      transferNumber: t.transferNumber,
      sourceLocationId: t.sourceLocationId,
      sourceLocationName: t.sourceLocation?.name,
      destinationLocationId: t.destinationLocationId,
      destinationLocationName: t.destinationLocation?.name,
      status: t.status as any,
      requestedById: t.requestedById,
      requestedByName: t.requestedBy?.name,
      approvedById: t.approvedById,
      shippedById: t.shippedById,
      receivedById: t.receivedById,
      shippedAt: t.shippedAt ? t.shippedAt.toISOString() : null,
      receivedAt: t.receivedAt ? t.receivedAt.toISOString() : null,
      notes: t.notes,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      lines: (t.lines || []).map((l: any) => ({
        id: l.id,
        stockTransferId: l.stockTransferId,
        productVariantId: l.productVariantId,
        sku: l.productVariant?.sku || '',
        productName: l.productVariant?.product?.name || '',
        variantName: l.productVariant?.name || null,
        requestedQty: Number(l.requestedQty),
        sentQty: Number(l.sentQty),
        receivedQty: Number(l.receivedQty),
        discrepancyQty: StockTransferEntity.calculateLineDiscrepancy(
          Number(l.sentQty),
          Number(l.receivedQty),
        ),
        batchNumber: l.batchNumber,
        sourceBinId: l.sourceBinId,
        destBinId: l.destBinId,
      })),
    };
  }
}
