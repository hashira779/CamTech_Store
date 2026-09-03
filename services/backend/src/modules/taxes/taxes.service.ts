import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Decimal } from '@prisma/client/runtime/library';
import { TaxCalculator } from './domain/tax-calculator';
import type {
  CreateTaxRateInput,
  UpdateTaxRateInput,
  CalculateTaxesInput,
  TaxRateDto,
  TaxCalculationResultDto,
} from '@mystore/contracts';

@Injectable()
export class TaxesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createTaxRate(
    orgId: string,
    actorId: string,
    input: CreateTaxRateInput,
  ): Promise<TaxRateDto> {
    const existing = await this.prisma.taxRate.findUnique({
      where: {
        organizationId_code: {
          organizationId: orgId,
          code: input.code,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Tax rate with code '${input.code}' already exists`);
    }

    const rate = await this.prisma.taxRate.create({
      data: {
        organizationId: orgId,
        code: input.code,
        name: input.name,
        ratePct: new Decimal(input.ratePct),
        isInclusive: Boolean(input.isInclusive),
        isCompound: Boolean(input.isCompound),
        isActive: input.isActive !== undefined ? input.isActive : true,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'TAX_RATE_CREATED',
      resourceType: 'TaxRate',
      resourceId: rate.id,
      metadata: { code: rate.code, ratePct: Number(rate.ratePct) },
    });

    return this.mapDto(rate);
  }

  async listTaxRates(orgId: string): Promise<TaxRateDto[]> {
    let rates = await this.prisma.taxRate.findMany({
      where: { organizationId: orgId },
      orderBy: { code: 'asc' },
    });

    // Auto-seed default tax rates for tenant if empty
    if (rates.length === 0) {
      const defaultVat = await this.prisma.taxRate.create({
        data: {
          organizationId: orgId,
          code: 'VAT-10',
          name: 'Standard Value Added Tax (10%)',
          ratePct: new Decimal(10.0),
          isInclusive: false,
          isCompound: false,
          isActive: true,
        },
      });

      const exempt = await this.prisma.taxRate.create({
        data: {
          organizationId: orgId,
          code: 'EXEMPT',
          name: 'Zero-Rated / Tax Exempt',
          ratePct: new Decimal(0.0),
          isInclusive: false,
          isCompound: false,
          isActive: true,
        },
      });

      rates = [defaultVat, exempt];
    }

    return rates.map((r) => this.mapDto(r));
  }

  async updateTaxRate(
    orgId: string,
    actorId: string,
    id: string,
    input: UpdateTaxRateInput,
  ): Promise<TaxRateDto> {
    const rate = await this.prisma.taxRate.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!rate) throw new NotFoundException(`TaxRate ${id} not found`);

    const updated = await this.prisma.taxRate.update({
      where: { id },
      data: {
        name: input.name !== undefined ? input.name : rate.name,
        ratePct: input.ratePct !== undefined ? new Decimal(input.ratePct) : rate.ratePct,
        isInclusive: input.isInclusive !== undefined ? input.isInclusive : rate.isInclusive,
        isCompound: input.isCompound !== undefined ? input.isCompound : rate.isCompound,
        isActive: input.isActive !== undefined ? input.isActive : rate.isActive,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'TAX_RATE_UPDATED',
      resourceType: 'TaxRate',
      resourceId: updated.id,
      metadata: { code: updated.code, ratePct: Number(updated.ratePct) },
    });

    return this.mapDto(updated);
  }

  async deleteTaxRate(orgId: string, actorId: string, id: string): Promise<{ success: boolean }> {
    const rate = await this.prisma.taxRate.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!rate) throw new NotFoundException(`TaxRate ${id} not found`);

    await this.prisma.taxRate.update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'TAX_RATE_DEACTIVATED',
      resourceType: 'TaxRate',
      resourceId: id,
      metadata: { code: rate.code },
    });

    return { success: true };
  }

  calculateTaxes(input: CalculateTaxesInput): TaxCalculationResultDto {
    return TaxCalculator.calculateCart(input.lines);
  }

  private mapDto(r: any): TaxRateDto {
    return {
      id: r.id,
      organizationId: r.organizationId,
      code: r.code,
      name: r.name,
      ratePct: Number(r.ratePct),
      isInclusive: r.isInclusive,
      isCompound: r.isCompound,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
