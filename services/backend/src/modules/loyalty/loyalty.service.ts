import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Decimal } from '@prisma/client/runtime/library';
import { LoyaltyCalculator } from './domain/loyalty-calculator';
import type {
  UpdateLoyaltyConfigInput,
  AdjustLoyaltyPointsInput,
  AdjustStoreCreditInput,
  RedeemLoyaltyPointsInput,
  LoyaltyProgramConfigDto,
  LoyaltyTransactionDto,
  StoreCreditTransactionDto,
  CustomerLoyaltyProfileDto,
  LoyaltyTier,
} from '@mystore/contracts';

@Injectable()
export class LoyaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Loyalty Program Config
  // ---------------------------------------------------------------------------

  async getOrCreateConfig(orgId: string): Promise<LoyaltyProgramConfigDto> {
    let config = await this.prisma.loyaltyProgramConfig.findUnique({
      where: { organizationId: orgId },
    });

    if (!config) {
      config = await this.prisma.loyaltyProgramConfig.create({
        data: {
          organizationId: orgId,
          earnRate: new Decimal(1.0),
          redeemRate: new Decimal(0.01),
          minPointsRedeem: 50,
          isActive: true,
        },
      });
    }

    return {
      id: config.id,
      organizationId: config.organizationId,
      earnRate: Number(config.earnRate),
      redeemRate: Number(config.redeemRate),
      minPointsRedeem: config.minPointsRedeem,
      isActive: config.isActive,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  async updateConfig(
    orgId: string,
    actorId: string,
    input: UpdateLoyaltyConfigInput,
  ): Promise<LoyaltyProgramConfigDto> {
    await this.getOrCreateConfig(orgId);

    const updated = await this.prisma.loyaltyProgramConfig.update({
      where: { organizationId: orgId },
      data: {
        earnRate: input.earnRate !== undefined ? new Decimal(input.earnRate) : undefined,
        redeemRate: input.redeemRate !== undefined ? new Decimal(input.redeemRate) : undefined,
        minPointsRedeem: input.minPointsRedeem !== undefined ? input.minPointsRedeem : undefined,
        isActive: input.isActive !== undefined ? input.isActive : undefined,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'LOYALTY_CONFIG_UPDATED',
      resourceType: 'LoyaltyProgramConfig',
      resourceId: updated.id,
      metadata: {
        earnRate: Number(updated.earnRate),
        redeemRate: Number(updated.redeemRate),
        isActive: updated.isActive,
      },
    });

    return {
      id: updated.id,
      organizationId: updated.organizationId,
      earnRate: Number(updated.earnRate),
      redeemRate: Number(updated.redeemRate),
      minPointsRedeem: updated.minPointsRedeem,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Customer Loyalty Profile
  // ---------------------------------------------------------------------------

  async getCustomerProfile(orgId: string, customerId: string): Promise<CustomerLoyaltyProfileDto> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId },
      include: {
        loyaltyTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        storeCreditTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    const tier = (customer.loyaltyTier || 'BRONZE') as LoyaltyTier;
    const tierMultiplier = LoyaltyCalculator.TIER_MULTIPLIERS[tier] ?? 1.0;

    return {
      customerId: customer.id,
      customerName: customer.name,
      loyaltyPoints: customer.loyaltyPoints,
      loyaltyTier: tier,
      tierMultiplier,
      storeCredit: Number(customer.storeCredit),
      recentLoyaltyTransactions: customer.loyaltyTransactions.map((tx) => this.mapLoyaltyTx(tx)),
      recentCreditTransactions: customer.storeCreditTransactions.map((tx) => this.mapCreditTx(tx)),
    };
  }

  // ---------------------------------------------------------------------------
  // Points Adjustment & Earning
  // ---------------------------------------------------------------------------

  async adjustPoints(
    orgId: string,
    actorId: string,
    input: AdjustLoyaltyPointsInput,
  ): Promise<LoyaltyTransactionDto> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: input.customerId, organizationId: orgId },
    });
    if (!customer) throw new NotFoundException(`Customer ${input.customerId} not found`);

    const newBalance = customer.loyaltyPoints + input.points;
    if (newBalance < 0) {
      throw new BadRequestException(
        `Cannot deduct ${Math.abs(input.points)} points. Customer balance is ${customer.loyaltyPoints}`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customer.id },
        data: { loyaltyPoints: newBalance },
      });

      return tx.loyaltyTransaction.create({
        data: {
          organizationId: orgId,
          customerId: customer.id,
          type: 'ADJUST',
          points: input.points,
          balanceAfter: newBalance,
          notes: input.notes || 'Manual points adjustment',
          actorId,
        },
      });
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'LOYALTY_POINTS_ADJUSTED',
      resourceType: 'Customer',
      resourceId: customer.id,
      metadata: { delta: input.points, balanceAfter: newBalance },
    });

    return this.mapLoyaltyTx(result);
  }

  async recordSaleEarn(
    orgId: string,
    customerId: string,
    saleId: string,
    netAmount: number,
  ): Promise<LoyaltyTransactionDto | null> {
    const config = await this.getOrCreateConfig(orgId);
    if (!config.isActive || netAmount <= 0) return null;

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId },
    });
    if (!customer) return null;

    const tier = (customer.loyaltyTier || 'BRONZE') as LoyaltyTier;
    const pointsEarned = LoyaltyCalculator.calculatePointsEarned(netAmount, config.earnRate, tier);
    if (pointsEarned <= 0) return null;

    const newBalance = customer.loyaltyPoints + pointsEarned;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customer.id },
        data: { loyaltyPoints: newBalance },
      });

      return tx.loyaltyTransaction.create({
        data: {
          organizationId: orgId,
          customerId: customer.id,
          type: 'EARN',
          points: pointsEarned,
          balanceAfter: newBalance,
          referenceType: 'Sale',
          referenceId: saleId,
          notes: `Points earned from sale (${tier} tier)`,
        },
      });
    });

    return this.mapLoyaltyTx(result);
  }

  async redeemPoints(
    orgId: string,
    actorId: string,
    input: RedeemLoyaltyPointsInput,
  ): Promise<{ transaction: LoyaltyTransactionDto; discountAmount: number }> {
    const config = await this.getOrCreateConfig(orgId);
    if (!config.isActive) {
      throw new BadRequestException('Loyalty program is currently inactive');
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: input.customerId, organizationId: orgId },
    });
    if (!customer) throw new NotFoundException(`Customer ${input.customerId} not found`);

    const evalResult = LoyaltyCalculator.calculateRedemptionDiscount(
      input.points,
      config.redeemRate,
      config.minPointsRedeem,
      customer.loyaltyPoints,
    );

    if (!evalResult.valid) {
      throw new BadRequestException(evalResult.error);
    }

    const newBalance = customer.loyaltyPoints - input.points;

    const txRecord = await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customer.id },
        data: { loyaltyPoints: newBalance },
      });

      return tx.loyaltyTransaction.create({
        data: {
          organizationId: orgId,
          customerId: customer.id,
          type: 'REDEEM',
          points: -input.points,
          balanceAfter: newBalance,
          notes: `Redeemed for $${evalResult.discountAmount.toFixed(2)} discount`,
          actorId,
        },
      });
    });

    return {
      transaction: this.mapLoyaltyTx(txRecord),
      discountAmount: evalResult.discountAmount,
    };
  }

  // ---------------------------------------------------------------------------
  // Store Credit Ledger
  // ---------------------------------------------------------------------------

  async adjustStoreCredit(
    orgId: string,
    actorId: string,
    input: AdjustStoreCreditInput,
  ): Promise<StoreCreditTransactionDto> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: input.customerId, organizationId: orgId },
    });
    if (!customer) throw new NotFoundException(`Customer ${input.customerId} not found`);

    const currentCredit = Number(customer.storeCredit);
    const delta = input.amount;
    const newBalance = Math.round((currentCredit + delta) * 100) / 100;

    if (newBalance < 0) {
      throw new BadRequestException(
        `Cannot deduct $${Math.abs(delta).toFixed(2)}. Available store credit is $${currentCredit.toFixed(2)}`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customer.id },
        data: { storeCredit: new Decimal(newBalance) },
      });

      return tx.storeCreditTransaction.create({
        data: {
          organizationId: orgId,
          customerId: customer.id,
          type: delta >= 0 ? 'CREDIT' : 'DEBIT',
          amount: new Decimal(delta),
          balanceAfter: new Decimal(newBalance),
          notes: input.notes || 'Store credit adjustment',
          actorId,
        },
      });
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'STORE_CREDIT_ADJUSTED',
      resourceType: 'Customer',
      resourceId: customer.id,
      metadata: { delta, balanceAfter: newBalance },
    });

    return this.mapCreditTx(result);
  }

  async listLoyaltyTransactions(
    orgId: string,
    customerId?: string,
  ): Promise<LoyaltyTransactionDto[]> {
    const txs = await this.prisma.loyaltyTransaction.findMany({
      where: {
        organizationId: orgId,
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return txs.map((tx) => this.mapLoyaltyTx(tx));
  }

  async listStoreCreditTransactions(
    orgId: string,
    customerId?: string,
  ): Promise<StoreCreditTransactionDto[]> {
    const txs = await this.prisma.storeCreditTransaction.findMany({
      where: {
        organizationId: orgId,
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return txs.map((tx) => this.mapCreditTx(tx));
  }

  private mapLoyaltyTx(tx: any): LoyaltyTransactionDto {
    return {
      id: tx.id,
      organizationId: tx.organizationId,
      customerId: tx.customerId,
      type: tx.type as any,
      points: tx.points,
      balanceAfter: tx.balanceAfter,
      referenceType: tx.referenceType,
      referenceId: tx.referenceId,
      notes: tx.notes,
      actorId: tx.actorId,
      createdAt: tx.createdAt.toISOString(),
    };
  }

  private mapCreditTx(tx: any): StoreCreditTransactionDto {
    return {
      id: tx.id,
      organizationId: tx.organizationId,
      customerId: tx.customerId,
      type: tx.type as any,
      amount: Number(tx.amount),
      balanceAfter: Number(tx.balanceAfter),
      referenceType: tx.referenceType,
      referenceId: tx.referenceId,
      notes: tx.notes,
      actorId: tx.actorId,
      createdAt: tx.createdAt.toISOString(),
    };
  }
}
