import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DepreciationCalculator } from './domain/depreciation-calculator';
import type {
  CreateFixedAssetInput,
  FixedAssetDto,
  DepreciationRecordDto,
  DepreciationMethod,
  AssetStatus,
} from '@mystore/contracts';

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listAssets(orgId: string): Promise<FixedAssetDto[]> {
    const assets = await this.prisma.fixedAsset.findMany({
      where: { organizationId: orgId },
      include: { depreciationRecords: { orderBy: { periodDate: 'desc' } } },
      orderBy: { assetCode: 'asc' },
    });

    return assets.map((a) => this.mapAssetDto(a));
  }

  async getAsset(orgId: string, id: string): Promise<FixedAssetDto> {
    const asset = await this.prisma.fixedAsset.findFirst({
      where: { id, organizationId: orgId },
      include: { depreciationRecords: { orderBy: { periodDate: 'desc' } } },
    });
    if (!asset) {
      throw new NotFoundException(`Fixed asset ${id} not found`);
    }
    return this.mapAssetDto(asset);
  }

  async createAsset(orgId: string, input: CreateFixedAssetInput): Promise<FixedAssetDto> {
    const existing = await this.prisma.fixedAsset.findUnique({
      where: { organizationId_assetCode: { organizationId: orgId, assetCode: input.assetCode } },
    });
    if (existing) {
      throw new ConflictException(`Asset code '${input.assetCode}' already exists`);
    }

    const created = await this.prisma.fixedAsset.create({
      data: {
        organizationId: orgId,
        assetCode: input.assetCode,
        name: input.name,
        category: input.category,
        purchaseDate: new Date(input.purchaseDate),
        purchaseCost: input.purchaseCost,
        salvageValue: input.salvageValue || 0,
        usefulLifeMonths: input.usefulLifeMonths || 60,
        depreciationMethod: input.depreciationMethod || 'STRAIGHT_LINE',
        accumulatedDeprec: 0,
        currentBookValue: input.purchaseCost,
        status: 'ACTIVE',
        locationId: input.locationId,
      },
      include: { depreciationRecords: true },
    });

    await this.audit.record({
      organizationId: orgId,
      action: 'ASSET_CREATED',
      resourceType: 'FixedAsset',
      resourceId: created.id,
      metadata: { code: created.assetCode, cost: Number(created.purchaseCost) },
    });

    return this.mapAssetDto(created);
  }

  async runDepreciation(orgId: string, assetId: string): Promise<DepreciationRecordDto> {
    const asset = await this.prisma.fixedAsset.findFirst({
      where: { id: assetId, organizationId: orgId },
    });
    if (!asset) {
      throw new NotFoundException(`Fixed asset ${assetId} not found`);
    }

    const depreciationAmount = DepreciationCalculator.computeMonthlyDepreciation({
      cost: Number(asset.purchaseCost),
      salvageValue: Number(asset.salvageValue),
      usefulLifeMonths: asset.usefulLifeMonths,
      method: asset.depreciationMethod as DepreciationMethod,
      accumulatedDepreciation: Number(asset.accumulatedDeprec),
      currentBookValue: Number(asset.currentBookValue),
    });

    const newAccumulated = Number(asset.accumulatedDeprec) + depreciationAmount;
    const newBookValue = Number(asset.currentBookValue) - depreciationAmount;

    const record = await this.prisma.$transaction(async (tx) => {
      const depRecord = await tx.depreciationRecord.create({
        data: {
          assetId,
          periodDate: new Date(),
          amount: depreciationAmount,
          bookValueAfter: newBookValue,
        },
      });

      await tx.fixedAsset.update({
        where: { id: assetId },
        data: {
          accumulatedDeprec: newAccumulated,
          currentBookValue: newBookValue,
        },
      });

      return depRecord;
    });

    await this.audit.record({
      organizationId: orgId,
      action: 'ASSET_DEPRECIATED',
      resourceType: 'FixedAsset',
      resourceId: assetId,
      metadata: { depreciationAmount, newBookValue },
    });

    return {
      id: record.id,
      assetId: record.assetId,
      periodDate: record.periodDate.toISOString(),
      amount: Number(record.amount),
      bookValueAfter: Number(record.bookValueAfter),
      journalEntryId: record.journalEntryId,
      createdAt: record.createdAt.toISOString(),
    };
  }

  private mapAssetDto(a: any): FixedAssetDto {
    return {
      id: a.id,
      organizationId: a.organizationId,
      assetCode: a.assetCode,
      name: a.name,
      category: a.category,
      purchaseDate: a.purchaseDate.toISOString(),
      purchaseCost: Number(a.purchaseCost),
      salvageValue: Number(a.salvageValue),
      usefulLifeMonths: a.usefulLifeMonths,
      depreciationMethod: a.depreciationMethod as DepreciationMethod,
      accumulatedDeprec: Number(a.accumulatedDeprec),
      currentBookValue: Number(a.currentBookValue),
      status: a.status as AssetStatus,
      locationId: a.locationId,
      records: (a.depreciationRecords || []).map((r: any) => ({
        id: r.id,
        assetId: r.assetId,
        periodDate: r.periodDate.toISOString(),
        amount: Number(r.amount),
        bookValueAfter: Number(r.bookValueAfter),
        journalEntryId: r.journalEntryId,
        createdAt: r.createdAt.toISOString(),
      })),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }
}
