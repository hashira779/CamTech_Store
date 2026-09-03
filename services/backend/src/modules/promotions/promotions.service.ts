import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  PromotionEvaluator,
  type PromotionDomainData,
} from './domain/promotion-evaluator';
import { Decimal } from '@prisma/client/runtime/library';
import type {
  CreatePromotionInput,
  UpdatePromotionInput,
  PromotionDto,
  EvaluatePromotionInput,
  PromotionEvaluationResultDto,
  Paginated,
} from '@mystore/contracts';

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createPromotion(
    orgId: string,
    input: CreatePromotionInput,
    actorId: string,
  ): Promise<PromotionDto> {
    if (input.code) {
      const existing = await this.prisma.promotion.findFirst({
        where: { organizationId: orgId, code: input.code.toUpperCase() },
      });
      if (existing) {
        throw new ConflictException(`Promotion with code "${input.code}" already exists`);
      }
    }

    const created = await this.prisma.promotion.create({
      data: {
        organizationId: orgId,
        name: input.name.trim(),
        code: input.code ? input.code.trim().toUpperCase() : null,
        description: input.description?.trim() || null,
        type: input.type,
        scope: input.scope || 'ORDER',
        discountValue: new Decimal(input.discountValue),
        minOrderAmount: input.minOrderAmount !== undefined && input.minOrderAmount !== null ? new Decimal(input.minOrderAmount) : null,
        maxDiscountAmount: input.maxDiscountAmount !== undefined && input.maxDiscountAmount !== null ? new Decimal(input.maxDiscountAmount) : null,
        buyQuantity: input.buyQuantity || null,
        getQuantity: input.getQuantity || null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        usageLimit: input.usageLimit || null,
        isActive: input.isActive ?? true,
        targetVariantIds: input.targetVariantIds ? JSON.stringify(input.targetVariantIds) : null,
        targetCategoryIds: input.targetCategoryIds ? JSON.stringify(input.targetCategoryIds) : null,
        customerTypes: input.customerTypes ? JSON.stringify(input.customerTypes) : null,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'PROMOTION_CREATED',
      resourceType: 'Promotion',
      resourceId: created.id,
      metadata: { name: created.name, code: created.code, type: created.type },
    });

    return this.mapToDto(created);
  }

  async listPromotions(
    orgId: string,
    query: { page: number; limit: number; type?: string; scope?: string; isActive?: boolean; search?: string },
  ): Promise<Paginated<PromotionDto>> {
    const where: any = { organizationId: orgId };
    if (query.type) where.type = query.type;
    if (query.scope) where.scope = query.scope;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.promotion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.promotion.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / query.limit));

    return {
      items: items.map((p) => this.mapToDto(p)),
      meta: { page: query.page, limit: query.limit, total, totalPages },
    };
  }

  async updatePromotion(
    orgId: string,
    id: string,
    input: UpdatePromotionInput,
    actorId: string,
  ): Promise<PromotionDto> {
    const existing = await this.prisma.promotion.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException(`Promotion ${id} not found`);

    if (input.code && input.code.toUpperCase() !== existing.code) {
      const conflict = await this.prisma.promotion.findFirst({
        where: { organizationId: orgId, code: input.code.toUpperCase(), id: { not: id } },
      });
      if (conflict) {
        throw new ConflictException(`Promotion with code "${input.code}" already exists`);
      }
    }

    const updated = await this.prisma.promotion.update({
      where: { id },
      data: {
        name: input.name ? input.name.trim() : undefined,
        code: input.code !== undefined ? (input.code ? input.code.trim().toUpperCase() : null) : undefined,
        description: input.description !== undefined ? input.description?.trim() || null : undefined,
        type: input.type,
        scope: input.scope,
        discountValue: input.discountValue !== undefined ? new Decimal(input.discountValue) : undefined,
        minOrderAmount: input.minOrderAmount !== undefined ? (input.minOrderAmount !== null ? new Decimal(input.minOrderAmount) : null) : undefined,
        maxDiscountAmount: input.maxDiscountAmount !== undefined ? (input.maxDiscountAmount !== null ? new Decimal(input.maxDiscountAmount) : null) : undefined,
        buyQuantity: input.buyQuantity !== undefined ? input.buyQuantity : undefined,
        getQuantity: input.getQuantity !== undefined ? input.getQuantity : undefined,
        startDate: input.startDate !== undefined ? (input.startDate ? new Date(input.startDate) : null) : undefined,
        endDate: input.endDate !== undefined ? (input.endDate ? new Date(input.endDate) : null) : undefined,
        usageLimit: input.usageLimit !== undefined ? input.usageLimit : undefined,
        isActive: input.isActive,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'PROMOTION_UPDATED',
      resourceType: 'Promotion',
      resourceId: id,
      metadata: { changes: input },
    });

    return this.mapToDto(updated);
  }

  async evaluateCart(
    orgId: string,
    input: EvaluatePromotionInput,
  ): Promise<PromotionEvaluationResultDto> {
    const subtotal = Number(
      input.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0).toFixed(4),
    );

    const promo = await this.prisma.promotion.findFirst({
      where: {
        organizationId: orgId,
        code: input.promoCode.trim().toUpperCase(),
      },
    });

    if (!promo) {
      return {
        valid: false,
        message: `Promo code "${input.promoCode}" is invalid`,
        subtotal,
        discountTotal: 0,
        netTotal: subtotal,
        lineDiscounts: [],
      };
    }

    const domainData: PromotionDomainData = {
      id: promo.id,
      name: promo.name,
      code: promo.code,
      type: promo.type,
      scope: promo.scope,
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
    };

    return PromotionEvaluator.evaluate(domainData, input.lines, input.customerType);
  }

  async getActiveByCode(orgId: string, code: string): Promise<PromotionDomainData | null> {
    const promo = await this.prisma.promotion.findFirst({
      where: {
        organizationId: orgId,
        code: code.trim().toUpperCase(),
        isActive: true,
      },
    });

    if (!promo) return null;

    return {
      id: promo.id,
      name: promo.name,
      code: promo.code,
      type: promo.type,
      scope: promo.scope,
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
    };
  }

  private mapToDto(p: any): PromotionDto {
    return {
      id: p.id,
      organizationId: p.organizationId,
      name: p.name,
      code: p.code,
      description: p.description,
      type: p.type,
      scope: p.scope,
      discountValue: Number(p.discountValue),
      minOrderAmount: p.minOrderAmount ? Number(p.minOrderAmount) : null,
      maxDiscountAmount: p.maxDiscountAmount ? Number(p.maxDiscountAmount) : null,
      buyQuantity: p.buyQuantity,
      getQuantity: p.getQuantity,
      startDate: p.startDate ? p.startDate.toISOString() : null,
      endDate: p.endDate ? p.endDate.toISOString() : null,
      usageLimit: p.usageLimit,
      currentUses: p.currentUses,
      isActive: p.isActive,
      targetVariantIds: p.targetVariantIds ? JSON.parse(p.targetVariantIds) : null,
      targetCategoryIds: p.targetCategoryIds ? JSON.parse(p.targetCategoryIds) : null,
      customerTypes: p.customerTypes ? JSON.parse(p.customerTypes) : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
