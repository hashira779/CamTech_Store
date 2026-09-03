import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { InventoryItemEntity } from '../domain/inventory-item.entity';
import { Decimal } from '@prisma/client/runtime/library';
import type { AdjustInventoryInput, InventoryItemDto, StockMovementDto } from '@mystore/contracts';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Adjust stock for a product variant at a location.
   * Creates a StockMovement record for audit trail.
   */
  async adjust(orgId: string, userId: string, input: AdjustInventoryInput): Promise<InventoryItemDto> {
    const isIncrease = ['ADJUSTMENT_IN', 'COUNT'].includes(input.type);
    const isDecrease = ['ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRED'].includes(input.type);

    if (!isIncrease && !isDecrease) {
      throw new BadRequestException(`Invalid adjustment type: ${input.type}`);
    }

    const quantity = isIncrease ? input.quantity : -input.quantity;

    const result = await this.prisma.$transaction(async (tx) => {
      // Upsert inventory item
      const item = await tx.inventoryItem.upsert({
        where: {
          organizationId_productVariantId_locationId: {
            organizationId: orgId,
            productVariantId: input.productVariantId,
            locationId: input.locationId,
          },
        },
        create: {
          organizationId: orgId,
          productVariantId: input.productVariantId,
          locationId: input.locationId,
          stockOnHand: new Decimal(quantity),
        },
        update: {
          stockOnHand: isIncrease
            ? { increment: new Decimal(input.quantity) }
            : { decrement: new Decimal(input.quantity) },
        },
        include: {
          productVariant: {
            include: { product: { select: { name: true } } },
          },
          location: { select: { name: true } },
        },
      });

      // Record movement
      await tx.stockMovement.create({
        data: {
          organizationId: orgId,
          inventoryItemId: item.id,
          type: input.type,
          quantity: new Decimal(quantity),
          balanceAfter: item.stockOnHand,
          referenceType: 'Adjustment',
          notes: input.notes ?? null,
          userId,
        },
      });

      return item;
    });

    await this.audit.record({
      organizationId: orgId,
      actorId: userId,
      action: `INVENTORY_${input.type}`,
      resourceType: 'InventoryItem',
      resourceId: result.id,
      metadata: { quantity, type: input.type },
    });

    return this.mapToDto(result);
  }

  /**
   * List inventory items with optional filters.
   */
  async findAll(
    orgId: string,
    query: { page: number; limit: number; locationId?: string; lowStockOnly?: boolean; search?: string },
  ) {
    const where: any = { organizationId: orgId };
    if (query.locationId) where.locationId = query.locationId;
    if (query.search) {
      where.productVariant = {
        OR: [
          { sku: { contains: query.search, mode: 'insensitive' } },
          { product: { name: { contains: query.search, mode: 'insensitive' } } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          productVariant: {
            include: { product: { select: { name: true } } },
          },
          location: { select: { name: true } },
        },
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);

    let dtos = items.map((item) => this.mapToDto(item));

    // Filter low stock in-memory (could be done in DB with raw SQL for perf)
    if (query.lowStockOnly) {
      dtos = dtos.filter((d) => d.isLowStock);
    }

    return {
      items: dtos,
      meta: {
        total: query.lowStockOnly ? dtos.length : total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil((query.lowStockOnly ? dtos.length : total) / query.limit),
      },
    };
  }

  /**
   * Get movement history for a specific variant.
   */
  async getMovements(orgId: string, variantId: string, page: number = 1, limit: number = 50): Promise<{ items: StockMovementDto[]; total: number }> {
    const inventoryItems = await this.prisma.inventoryItem.findMany({
      where: { organizationId: orgId, productVariantId: variantId },
      select: { id: true },
    });
    const itemIds = inventoryItems.map((i) => i.id);

    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: { inventoryItemId: { in: itemIds } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockMovement.count({
        where: { inventoryItemId: { in: itemIds } },
      }),
    ]);

    return {
      items: movements.map((m) => ({
        id: m.id,
        type: m.type as any,
        quantity: Number(m.quantity),
        balanceAfter: Number(m.balanceAfter),
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        notes: m.notes,
        userId: m.userId,
        createdAt: m.createdAt.toISOString(),
      })),
      total,
    };
  }

  private mapToDto(item: any): InventoryItemDto {
    const stockOnHand = Number(item.stockOnHand);
    const reservedQty = Number(item.reservedQty);
    const minimumStock = Number(item.minimumStock);
    const reorderPoint = item.reorderPoint ? Number(item.reorderPoint) : null;

    const entity = new InventoryItemEntity(stockOnHand, reservedQty, minimumStock, reorderPoint);

    return {
      id: item.id,
      organizationId: item.organizationId,
      productVariantId: item.productVariantId,
      locationId: item.locationId,
      sku: item.productVariant?.sku ?? '',
      productName: item.productVariant?.product?.name ?? '',
      variantName: item.productVariant?.name ?? null,
      stockOnHand,
      reservedQty,
      availableQty: entity.availableQty,
      minimumStock,
      maximumStock: item.maximumStock ? Number(item.maximumStock) : null,
      reorderPoint,
      isLowStock: entity.isLowStock,
      locationName: item.location?.name ?? '',
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
