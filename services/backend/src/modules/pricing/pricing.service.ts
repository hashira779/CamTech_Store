import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PricingResolver } from './domain/pricing-resolver';
import { Decimal } from '@prisma/client/runtime/library';
import type {
  CreatePriceListInput,
  UpdatePriceListInput,
  SetPriceListItemInput,
  ResolvePricesInput,
  PriceListDto,
  PriceListItemDto,
  ResolvedPricesResultDto,
  Paginated,
} from '@mystore/contracts';

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createPriceList(
    orgId: string,
    input: CreatePriceListInput,
    actorId: string,
  ): Promise<PriceListDto> {
    const code = input.code.trim().toUpperCase();
    const existing = await this.prisma.priceList.findFirst({
      where: { organizationId: orgId, code },
    });
    if (existing) {
      throw new ConflictException(`Price list with code "${input.code}" already exists`);
    }

    // If marked as default for a customer type, unset existing default
    if (input.isDefault && input.customerType) {
      await this.prisma.priceList.updateMany({
        where: { organizationId: orgId, customerType: input.customerType, isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await this.prisma.priceList.create({
      data: {
        organizationId: orgId,
        name: input.name.trim(),
        code,
        description: input.description?.trim() || null,
        currency: input.currency || 'USD',
        isDefault: input.isDefault ?? false,
        customerType: input.customerType ?? null,
        isActive: input.isActive ?? true,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'PRICE_LIST_CREATED',
      resourceType: 'PriceList',
      resourceId: created.id,
      metadata: { name: created.name, code: created.code },
    });

    return this.mapPriceListToDto(created, 0);
  }

  async listPriceLists(
    orgId: string,
    query: { page: number; limit: number; customerType?: string; isActive?: boolean; search?: string },
  ): Promise<Paginated<PriceListDto>> {
    const where: any = { organizationId: orgId };
    if (query.customerType) where.customerType = query.customerType;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.priceList.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { _count: { select: { items: true } } },
      }),
      this.prisma.priceList.count({ where }),
    ]);

    return {
      items: items.map((pl) => this.mapPriceListToDto(pl, pl._count.items)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getPriceListById(orgId: string, id: string): Promise<PriceListDto> {
    const pl = await this.prisma.priceList.findFirst({
      where: { id, organizationId: orgId },
      include: {
        items: {
          include: {
            productVariant: {
              include: { product: { select: { name: true } } },
            },
          },
          orderBy: [{ productVariantId: 'asc' }, { minQuantity: 'asc' }],
        },
      },
    });
    if (!pl) throw new NotFoundException(`Price list ${id} not found`);

    return {
      ...this.mapPriceListToDto(pl, pl.items.length),
      items: pl.items.map((i) => this.mapItemToDto(i)),
    };
  }

  async updatePriceList(
    orgId: string,
    id: string,
    input: UpdatePriceListInput,
    actorId: string,
  ): Promise<PriceListDto> {
    const pl = await this.prisma.priceList.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!pl) throw new NotFoundException(`Price list ${id} not found`);

    if (input.code && input.code.toUpperCase() !== pl.code) {
      const conflict = await this.prisma.priceList.findFirst({
        where: { organizationId: orgId, code: input.code.toUpperCase(), id: { not: id } },
      });
      if (conflict) {
        throw new ConflictException(`Price list with code "${input.code}" already exists`);
      }
    }

    const updated = await this.prisma.priceList.update({
      where: { id },
      data: {
        name: input.name ? input.name.trim() : undefined,
        code: input.code ? input.code.trim().toUpperCase() : undefined,
        description: input.description !== undefined ? input.description?.trim() || null : undefined,
        isDefault: input.isDefault,
        customerType: input.customerType,
        isActive: input.isActive,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'PRICE_LIST_UPDATED',
      resourceType: 'PriceList',
      resourceId: id,
      metadata: { changes: input },
    });

    return this.mapPriceListToDto(updated);
  }

  async setPriceListItem(
    orgId: string,
    priceListId: string,
    input: SetPriceListItemInput,
    actorId: string,
  ): Promise<PriceListItemDto> {
    const pl = await this.prisma.priceList.findFirst({
      where: { id: priceListId, organizationId: orgId },
    });
    if (!pl) throw new NotFoundException(`Price list ${priceListId} not found`);

    const variant = await this.prisma.productVariant.findFirst({
      where: { id: input.productVariantId, organizationId: orgId },
      include: { product: { select: { name: true } } },
    });
    if (!variant) throw new NotFoundException(`Product variant ${input.productVariantId} not found`);

    const minQuantity = new Decimal(input.minQuantity ?? 1);

    const item = await this.prisma.priceListItem.upsert({
      where: {
        priceListId_productVariantId_minQuantity: {
          priceListId,
          productVariantId: input.productVariantId,
          minQuantity,
        },
      },
      create: {
        priceListId,
        productVariantId: input.productVariantId,
        unitPrice: new Decimal(input.unitPrice),
        minQuantity,
      },
      update: {
        unitPrice: new Decimal(input.unitPrice),
      },
      include: {
        productVariant: {
          include: { product: { select: { name: true } } },
        },
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'PRICE_LIST_ITEM_SET',
      resourceType: 'PriceListItem',
      resourceId: item.id,
      metadata: { priceListId, variantId: input.productVariantId, unitPrice: input.unitPrice, minQuantity: input.minQuantity },
    });

    return this.mapItemToDto(item);
  }

  async deletePriceListItem(
    orgId: string,
    priceListId: string,
    itemId: string,
    actorId: string,
  ): Promise<{ success: boolean }> {
    const pl = await this.prisma.priceList.findFirst({
      where: { id: priceListId, organizationId: orgId },
    });
    if (!pl) throw new NotFoundException(`Price list ${priceListId} not found`);

    await this.prisma.priceListItem.delete({
      where: { id: itemId },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'PRICE_LIST_ITEM_DELETED',
      resourceType: 'PriceListItem',
      resourceId: itemId,
    });

    return { success: true };
  }

  async resolvePrices(
    orgId: string,
    input: ResolvePricesInput,
  ): Promise<ResolvedPricesResultDto> {
    // 1. Determine applicable PriceList
    let priceList: any = null;

    if (input.priceListId) {
      priceList = await this.prisma.priceList.findFirst({
        where: { id: input.priceListId, organizationId: orgId, isActive: true },
        include: { items: true },
      });
    } else if (input.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: input.customerId },
      });
      if (customer) {
        if (customer.priceListId) {
          priceList = await this.prisma.priceList.findFirst({
            where: { id: customer.priceListId, organizationId: orgId, isActive: true },
            include: { items: true },
          });
        }
        if (!priceList && customer.type) {
          // Fallback to customer type default
          priceList = await this.prisma.priceList.findFirst({
            where: { organizationId: orgId, customerType: customer.type, isDefault: true, isActive: true },
            include: { items: true },
          });
        }
      }
    }

    // 2. Fetch base variants
    const variantIds = input.lines.map((l) => l.productVariantId);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, organizationId: orgId },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // 3. Resolve each line
    const resolvedLines = input.lines.map((line) => {
      const v = variantMap.get(line.productVariantId);
      if (!v) {
        throw new BadRequestException(`Variant ${line.productVariantId} not found`);
      }

      const candidateItems = (priceList?.items ?? [])
        .filter((i: any) => i.productVariantId === line.productVariantId)
        .map((i: any) => ({
          productVariantId: i.productVariantId,
          unitPrice: Number(i.unitPrice),
          minQuantity: Number(i.minQuantity),
          priceListName: priceList?.name,
        }));

      return PricingResolver.resolvePrice(
        {
          id: v.id,
          sellPrice: Number(v.sellPrice),
          costPrice: Number(v.costPrice),
        },
        line.quantity,
        candidateItems,
      );
    });

    return {
      priceListApplied: priceList
        ? { id: priceList.id, name: priceList.name, code: priceList.code }
        : null,
      lines: resolvedLines,
    };
  }

  private mapPriceListToDto(pl: any, itemCount = 0): PriceListDto {
    return {
      id: pl.id,
      organizationId: pl.organizationId,
      name: pl.name,
      code: pl.code,
      description: pl.description,
      currency: pl.currency,
      isDefault: pl.isDefault,
      customerType: pl.customerType,
      isActive: pl.isActive,
      itemCount,
      createdAt: pl.createdAt.toISOString(),
      updatedAt: pl.updatedAt.toISOString(),
    };
  }

  private mapItemToDto(item: any): PriceListItemDto {
    return {
      id: item.id,
      priceListId: item.priceListId,
      productVariantId: item.productVariantId,
      sku: item.productVariant.sku,
      productName: item.productVariant.product.name,
      variantName: item.productVariant.name,
      baseSellPrice: Number(item.productVariant.sellPrice),
      costPrice: Number(item.productVariant.costPrice),
      unitPrice: Number(item.unitPrice),
      minQuantity: Number(item.minQuantity),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
