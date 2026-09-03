import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CustomerEntity } from '../domain/customer.entity';
import { AuditService } from '../../audit/audit.service';
import type { CreateCustomerInput, UpdateCustomerInput } from '@mystore/contracts';

/** Max attempts to allocate a unique sequential customer code under concurrency. */
const CODE_ALLOC_ATTEMPTS = 5;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(orgId: string, input: CreateCustomerInput, actorId: string): Promise<CustomerEntity> {
    // The customer code is derived from a per-org count, which is racy under
    // concurrency: two simultaneous creates can compute the same code and
    // collide on @@unique([organizationId, code]). Recompute + retry on the
    // unique-violation (P2002) so legitimate concurrent creates succeed instead
    // of surfacing an intermittent error.
    const row = await this.createWithUniqueCode(orgId, input);

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'CUSTOMER_CREATED',
      resourceType: 'Customer',
      resourceId: row.id,
    });

    return CustomerEntity.fromPrisma(row);
  }

  /** Allocates the next sequential customer code, retrying on unique collisions. */
  private async createWithUniqueCode(orgId: string, input: CreateCustomerInput) {
    for (let attempt = 0; attempt < CODE_ALLOC_ATTEMPTS; attempt++) {
      const count = await this.prisma.customer.count({ where: { organizationId: orgId } });
      const code = CustomerEntity.generateCode(count);
      try {
        return await this.prisma.customer.create({
          data: {
            organizationId: orgId,
            code,
            name: input.name,
            email: input.email ?? null,
            phone: input.phone ?? null,
            taxId: input.taxId ?? null,
            type: input.type ?? 'INDIVIDUAL',
            notes: input.notes ?? null,
            isActive: input.isActive ?? true,
          },
        });
      } catch (err) {
        const retryable =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          attempt < CODE_ALLOC_ATTEMPTS - 1;
        if (!retryable) throw err;
        // Another concurrent create won this code; loop to recompute and retry.
      }
    }
    // Unreachable: the loop returns on success or throws on the final attempt.
    throw new Error('Failed to allocate a unique customer code');
  }

  async findAll(
    orgId: string,
    query: { page: number; limit: number; search?: string; type?: string },
  ) {
    const where: any = { organizationId: orgId };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.type) {
      where.type = query.type;
    }

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items: items.map((r) => CustomerEntity.fromPrisma(r).toDto()),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findById(orgId: string, id: string): Promise<CustomerEntity> {
    const row = await this.prisma.customer.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!row) throw new NotFoundException('Customer not found');
    return CustomerEntity.fromPrisma(row);
  }

  async update(orgId: string, id: string, input: UpdateCustomerInput, actorId: string): Promise<CustomerEntity> {
    // Verify ownership
    await this.findById(orgId, id);

    const row = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.taxId !== undefined && { taxId: input.taxId }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'CUSTOMER_UPDATED',
      resourceType: 'Customer',
      resourceId: id,
    });

    return CustomerEntity.fromPrisma(row);
  }
}
