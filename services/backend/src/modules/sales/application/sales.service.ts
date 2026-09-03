import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { SaleEntity } from '../domain/sale.entity';
import { PromotionEvaluator } from '../../promotions/domain/promotion-evaluator';
import { PricingResolver } from '../../pricing/domain/pricing-resolver';
import type {
  CreateSaleInput,
  SaleDto,
  SaleSummaryDto,
  SyncBatchRequest,
  SyncBatchResponseDto,
  OfflineSaleResultDto,
} from '@mystore/contracts';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Create and complete a sale in a single atomic transaction.
   *
   * Critical design decisions per spec:
   *  - Prices are ALWAYS looked up from ProductVariant (§11 — never trust client)
   *  - Idempotency key prevents duplicate sales from POS retries (§15)
   *  - Inventory is decremented atomically in the same transaction (§16)
   */
  async createSale(orgId: string, userId: string, input: CreateSaleInput): Promise<SaleDto> {
    // 1. Idempotency check (spec §15)
    if (input.idempotencyKey) {
      const existing = await this.prisma.sale.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: {
          lineItems: true,
          payments: true,
          customer: { select: { id: true, name: true, code: true } },
        },
      });
      if (existing) {
        // Verify it belongs to same org (security)
        if (existing.organizationId !== orgId) {
          throw new ConflictException('Idempotency key conflict');
        }
        return this.mapSaleToDto(existing);
      }
    }

    // 2. Look up all variant prices SERVER-SIDE (spec §11 — never trust client prices)
    const variantIds = input.lineItems.map((li) => li.productVariantId);
    const variants = await this.prisma.productVariant.findMany({
      where: {
        id: { in: variantIds },
        organizationId: orgId,
        isActive: true,
      },
      include: { product: { select: { name: true } }, taxRate: true },
    });

    if (variants.length !== variantIds.length) {
      const found = new Set(variants.map((v) => v.id));
      const missing = variantIds.filter((id) => !found.has(id));
      throw new BadRequestException(`Product variants not found: ${missing.join(', ')}`);
    }

    // 2.2 Resolve customer or tier price list overrides (spec §23)
    let customerPriceList: any = null;
    let customerType: any = null;
    if (input.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: input.customerId },
      });
      if (customer) {
        customerType = customer.type;
        if (customer.priceListId) {
          customerPriceList = await this.prisma.priceList.findFirst({
            where: { id: customer.priceListId, organizationId: orgId, isActive: true },
            include: { items: true },
          });
        }
        if (!customerPriceList && customer.type) {
          customerPriceList = await this.prisma.priceList.findFirst({
            where: { organizationId: orgId, customerType: customer.type, isDefault: true, isActive: true },
            include: { items: true },
          });
        }
      }
    }

    // Resolve effective variant sellPrice considering volume breaks and customer price list
    const effectiveVariants = variants.map((v) => {
      const lineInput = input.lineItems.find((li) => li.productVariantId === v.id);
      const qty = lineInput ? lineInput.quantity : 1;
      const candidateItems = (customerPriceList?.items ?? [])
        .filter((i: any) => i.productVariantId === v.id)
        .map((i: any) => ({
          productVariantId: i.productVariantId,
          unitPrice: Number(i.unitPrice),
          minQuantity: Number(i.minQuantity),
        }));

      const resolved = PricingResolver.resolvePrice(
        { id: v.id, sellPrice: Number(v.sellPrice), costPrice: Number(v.costPrice) },
        qty,
        candidateItems,
      );

      return {
        ...v,
        sellPrice: new Decimal(resolved.resolvedUnitPrice),
      };
    });

    // 2.5 Evaluate promotional coupon if provided (spec §24)
    let appliedPromotion: any = null;
    const workingLineInputs = input.lineItems.map((li) => ({ ...li }));

    if (input.promoCode) {
      const promo = await this.prisma.promotion.findFirst({
        where: { organizationId: orgId, code: input.promoCode.trim().toUpperCase() },
      });
      if (!promo) {
        throw new BadRequestException(`Promo code "${input.promoCode}" is invalid`);
      }

      const evalResult = PromotionEvaluator.evaluate(
        {
          id: promo.id,
          name: promo.name,
          code: promo.code,
          type: promo.type as any,
          scope: promo.scope as any,
          discountValue: Number(promo.discountValue),
          minOrderAmount: promo.minOrderAmount ? Number(promo.minOrderAmount) : null,
          maxDiscountAmount: promo.maxDiscountAmount ? Number(promo.maxDiscountAmount) : null,
          buyQuantity: promo.buyQuantity,
          getQuantity: promo.getQuantity,
          startDate: promo.startDate,
          endDate: promo.endDate,
          usageLimit: promo.usageLimit,
          currentUses: promo.currentUses,
          isActive: promo.isActive,
          targetVariantIds: promo.targetVariantIds ? JSON.parse(promo.targetVariantIds) : null,
          targetCategoryIds: promo.targetCategoryIds ? JSON.parse(promo.targetCategoryIds) : null,
          customerTypes: promo.customerTypes ? JSON.parse(promo.customerTypes) : null,
        },
        input.lineItems.map((li) => {
          const v = effectiveVariants.find((v) => v.id === li.productVariantId);
          return {
            productVariantId: li.productVariantId,
            quantity: li.quantity,
            unitPrice: Number(v!.sellPrice),
            categoryId: (v as any).product?.categoryId,
          };
        }),
        customerType,
      );

      if (!evalResult.valid) {
        throw new BadRequestException(evalResult.message || 'Promotion is not valid for this order');
      }

      appliedPromotion = promo;

      // Apply computed discounts into workingLineInputs
      for (const li of workingLineInputs) {
        const match = evalResult.lineDiscounts.find((ld) => ld.productVariantId === li.productVariantId);
        if (match) {
          li.discount = (li.discount || 0) + match.discount;
        }
      }
    }

    // 3. Calculate lines with server-side prices and applied discounts
    const calculatedLines = SaleEntity.calculateLines(effectiveVariants, workingLineInputs);
    const totals = SaleEntity.computeTotals(calculatedLines);

    // 4. Validate payments cover the total
    const paymentCheck = SaleEntity.validatePayments(input.payments, totals.grandTotal);
    if (!paymentCheck.valid) {
      throw new BadRequestException(
        `Insufficient payment: total ${totals.grandTotal}, paid ${paymentCheck.totalPaid}`,
      );
    }

    // 5. Generate sale number
    const saleNumber = await this.generateSaleNumber(orgId);

    // 6. Create sale + line items + payments + decrement inventory in ONE transaction (spec §16)
    const sale = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          organizationId: orgId,
          userId,
          customerId: input.customerId ?? null,
          locationId: input.locationId ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          saleNumber,
          channel: input.channel ?? 'POS',
          status: 'COMPLETED',
          subtotal: new Decimal(totals.subtotal),
          discountTotal: new Decimal(totals.discountTotal),
          taxTotal: new Decimal(totals.taxTotal),
          grandTotal: new Decimal(totals.grandTotal),
          currency: input.currency ?? 'USD',
          notes: input.notes ?? null,
          promotionId: appliedPromotion?.id ?? null,
          promotionCode: appliedPromotion?.code ?? null,
          completedAt: new Date(),
          lineItems: {
            create: calculatedLines.map((line) => ({
              productVariantId: line.productVariantId,
              sku: line.sku,
              productName: line.productName,
              variantName: line.variantName,
              quantity: new Decimal(line.quantity),
              unitPrice: new Decimal(line.unitPrice),
              discount: new Decimal(line.discount),
              taxRatePct: new Decimal(line.taxRatePct),
              taxAmount: new Decimal(line.taxAmount),
              lineTotal: new Decimal(line.lineTotal),
            })),
          },
          payments: {
            create: input.payments.map((p) => ({
              method: p.method,
              amount: new Decimal(p.amount),
              reference: p.reference ?? null,
            })),
          },
        },
        include: {
          lineItems: true,
          payments: true,
          customer: { select: { id: true, name: true, code: true } },
        },
      });

      // 7. Decrement inventory for each line item (spec §29)
      for (const line of calculatedLines) {
        if (input.locationId) {
          // Upsert inventory item, then decrement
          const inventoryItem = await tx.inventoryItem.upsert({
            where: {
              organizationId_productVariantId_locationId: {
                organizationId: orgId,
                productVariantId: line.productVariantId,
                locationId: input.locationId,
              },
            },
            create: {
              organizationId: orgId,
              productVariantId: line.productVariantId,
              locationId: input.locationId,
              stockOnHand: new Decimal(-line.quantity), // Will go negative if no initial stock
            },
            update: {
              stockOnHand: { decrement: new Decimal(line.quantity) },
            },
          });

          // Record stock movement
          await tx.stockMovement.create({
            data: {
              organizationId: orgId,
              inventoryItemId: inventoryItem.id,
              type: 'SALE',
              quantity: new Decimal(-line.quantity),
              balanceAfter: inventoryItem.stockOnHand,
              referenceType: 'Sale',
              referenceId: created.id,
              userId,
            },
          });
        }
      }

      // 7.5 Increment promotion usage counter if applied
      if (appliedPromotion) {
        await tx.promotion.update({
          where: { id: appliedPromotion.id },
          data: { currentUses: { increment: 1 } },
        });
      }

      return created;
    });

    // 8. Audit log
    await this.audit.record({
      organizationId: orgId,
      actorId: userId,
      action: 'SALE_COMPLETED',
      resourceType: 'Sale',
      resourceId: sale.id,
      metadata: {
        saleNumber: sale.saleNumber,
        grandTotal: totals.grandTotal,
        itemCount: calculatedLines.length,
      },
    });

    return this.mapSaleToDto(sale);
  }

  async findAll(
    orgId: string,
    query: { page: number; limit: number; status?: string; channel?: string; search?: string; from?: string; to?: string },
  ) {
    const where: any = { organizationId: orgId };
    if (query.status) where.status = query.status;
    if (query.channel) where.channel = query.channel;
    if (query.search) {
      where.OR = [
        { saleNumber: { contains: query.search, mode: 'insensitive' } },
        { customer: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const [items, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          customer: { select: { name: true } },
          _count: { select: { lineItems: true } },
        },
      }),
      this.prisma.sale.count({ where }),
    ]);

    const summaries: SaleSummaryDto[] = items.map((s) => ({
      id: s.id,
      saleNumber: s.saleNumber,
      channel: s.channel as any,
      status: s.status as any,
      grandTotal: Number(s.grandTotal),
      currency: s.currency,
      promotionCode: s.promotionCode ?? null,
      customerName: s.customer?.name ?? null,
      itemCount: s._count.lineItems,
      completedAt: s.completedAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    }));

    return {
      items: summaries,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findById(orgId: string, id: string): Promise<SaleDto> {
    const sale = await this.prisma.sale.findFirst({
      where: { id, organizationId: orgId },
      include: {
        lineItems: true,
        payments: true,
        customer: { select: { id: true, name: true, code: true } },
      },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return this.mapSaleToDto(sale);
  }

  async voidSale(orgId: string, id: string, userId: string): Promise<SaleDto> {
    const sale = await this.prisma.sale.findFirst({
      where: { id, organizationId: orgId },
      include: { lineItems: true },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.status !== 'COMPLETED') {
      throw new BadRequestException(`Cannot void a sale with status ${sale.status}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.sale.update({
        where: { id },
        data: { status: 'VOIDED' },
        include: {
          lineItems: true,
          payments: true,
          customer: { select: { id: true, name: true, code: true } },
        },
      });

      // Reverse inventory
      if (sale.locationId) {
        for (const line of sale.lineItems) {
          const inventoryItem = await tx.inventoryItem.update({
            where: {
              organizationId_productVariantId_locationId: {
                organizationId: orgId,
                productVariantId: line.productVariantId,
                locationId: sale.locationId,
              },
            },
            data: {
              stockOnHand: { increment: line.quantity },
            },
          });

          await tx.stockMovement.create({
            data: {
              organizationId: orgId,
              inventoryItemId: inventoryItem.id,
              type: 'SALE_VOID',
              quantity: line.quantity,
              balanceAfter: inventoryItem.stockOnHand,
              referenceType: 'Sale',
              referenceId: id,
              userId,
            },
          });
        }
      }

      return result;
    });

    await this.audit.record({
      organizationId: orgId,
      actorId: userId,
      action: 'SALE_VOIDED',
      resourceType: 'Sale',
      resourceId: id,
    });

    return this.mapSaleToDto(updated);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private async generateSaleNumber(orgId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.sale.count({
      where: {
        organizationId: orgId,
        saleNumber: { startsWith: `S-${year}` },
      },
    });
    return `S-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  private mapSaleToDto(sale: any): SaleDto {
    return {
      id: sale.id,
      organizationId: sale.organizationId,
      locationId: sale.locationId,
      customerId: sale.customerId,
      userId: sale.userId,
      saleNumber: sale.saleNumber,
      channel: sale.channel,
      status: sale.status,
      subtotal: Number(sale.subtotal),
      discountTotal: Number(sale.discountTotal),
      taxTotal: Number(sale.taxTotal),
      grandTotal: Number(sale.grandTotal),
      currency: sale.currency,
      promotionCode: sale.promotionCode ?? null,
      notes: sale.notes,
      completedAt: sale.completedAt?.toISOString() ?? null,
      createdAt: sale.createdAt.toISOString(),
      updatedAt: sale.updatedAt.toISOString(),
      lineItems: (sale.lineItems ?? []).map((li: any) => ({
        id: li.id,
        productVariantId: li.productVariantId,
        sku: li.sku,
        productName: li.productName,
        variantName: li.variantName,
        quantity: Number(li.quantity),
        unitPrice: Number(li.unitPrice),
        discount: Number(li.discount),
        taxRatePct: Number(li.taxRatePct),
        taxAmount: Number(li.taxAmount),
        lineTotal: Number(li.lineTotal),
      })),
      payments: (sale.payments ?? []).map((p: any) => ({
        id: p.id,
        method: p.method,
        amount: Number(p.amount),
        reference: p.reference,
        paidAt: p.paidAt.toISOString(),
      })),
      customer: sale.customer ?? null,
    };
  }

  /**
   * Replays a batch of offline POS sales with idempotency checks and audit logging (Spec §17, §18).
   */
  async syncBatch(
    orgId: string,
    actorId: string,
    batch: SyncBatchRequest,
  ): Promise<SyncBatchResponseDto> {
    const results: OfflineSaleResultDto[] = [];
    let syncedCount = 0;
    let failedCount = 0;

    for (const item of batch.sales) {
      try {
        // 1. Check idempotency if key provided
        if (item.idempotencyKey) {
          const existing = await this.prisma.sale.findFirst({
            where: { organizationId: orgId, idempotencyKey: item.idempotencyKey },
          });
          if (existing) {
            results.push({
              localId: item.localId,
              status: 'DUPLICATE',
              saleId: existing.id,
              saleNumber: existing.saleNumber,
              grandTotal: Number(existing.grandTotal),
            });
            syncedCount++;
            continue;
          }
        }

        // 2. Create the sale
        const sale = await this.createSale(orgId, actorId, item);

        await this.audit.record({
          organizationId: orgId,
          actorId,
          action: 'OFFLINE_SALE_SYNCED',
          resourceType: 'Sale',
          resourceId: sale.id,
          metadata: {
            localId: item.localId,
            clientCreatedAt: item.clientCreatedAt,
            saleNumber: sale.saleNumber,
          },
        });

        results.push({
          localId: item.localId,
          status: 'SYNCED',
          saleId: sale.id,
          saleNumber: sale.saleNumber,
          grandTotal: sale.grandTotal,
        });
        syncedCount++;
      } catch (err: any) {
        failedCount++;
        results.push({
          localId: item.localId,
          status: 'FAILED',
          error: err.message || 'Unknown error occurred while processing offline sale',
        });
      }
    }

    return {
      syncedCount,
      failedCount,
      results,
    };
  }
}
