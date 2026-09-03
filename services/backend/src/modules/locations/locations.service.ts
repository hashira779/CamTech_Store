import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LocationEntity } from './domain/location.entity';
import type {
  CreateLocationInput,
  UpdateLocationInput,
  LocationDto,
  LocationTreeNodeDto,
  Paginated,
} from '@mystore/contracts';

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(orgId: string, input: CreateLocationInput, actorId: string): Promise<LocationDto> {
    // Validate domain rules
    new LocationEntity(input.name, input.type, input.code ?? null, input.parentId ?? null, orgId);

    // Verify parent exists if provided
    if (input.parentId) {
      const parent = await this.prisma.location.findFirst({
        where: { id: input.parentId, organizationId: orgId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent location ${input.parentId} not found`);
      }
    }

    // Verify code uniqueness in organization if provided
    if (input.code) {
      const existing = await this.prisma.location.findFirst({
        where: { organizationId: orgId, code: input.code },
      });
      if (existing) {
        throw new ConflictException(`Location with code "${input.code}" already exists in organization`);
      }
    }

    const created = await this.prisma.location.create({
      data: {
        organizationId: orgId,
        parentId: input.parentId ?? null,
        type: input.type,
        name: input.name.trim(),
        code: input.code ? input.code.trim() : null,
      },
      include: {
        parent: { select: { id: true, name: true, type: true } },
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'LOCATION_CREATED',
      resourceType: 'Location',
      resourceId: created.id,
      metadata: { name: created.name, type: created.type, code: created.code },
    });

    return this.mapToDto(created);
  }

  async findAll(
    orgId: string,
    query: { page: number; limit: number; search?: string; type?: string; parentId?: string | null },
  ): Promise<Paginated<LocationDto>> {
    const where: any = { organizationId: orgId };
    if (query.type) where.type = query.type;
    if (query.parentId !== undefined) where.parentId = query.parentId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.location.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          parent: { select: { id: true, name: true, type: true } },
          _count: { select: { children: true } },
        },
      }),
      this.prisma.location.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / query.limit));

    return {
      items: items.map((loc) => ({
        id: loc.id,
        organizationId: loc.organizationId,
        parentId: loc.parentId,
        type: loc.type as any,
        name: loc.name,
        code: loc.code,
        createdAt: loc.createdAt.toISOString(),
        updatedAt: loc.updatedAt.toISOString(),
        parent: loc.parent ? { id: loc.parent.id, name: loc.parent.name, type: loc.parent.type as any } : null,
        childrenCount: loc._count.children,
      })),
      meta: { page: query.page, limit: query.limit, total, totalPages },
    };
  }

  async getTree(orgId: string): Promise<LocationTreeNodeDto[]> {
    const allLocations = await this.prisma.location.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
    });

    const nodeMap = new Map<string, LocationTreeNodeDto>();
    for (const loc of allLocations) {
      nodeMap.set(loc.id, {
        id: loc.id,
        organizationId: loc.organizationId,
        parentId: loc.parentId,
        type: loc.type as any,
        name: loc.name,
        code: loc.code,
        createdAt: loc.createdAt.toISOString(),
        children: [],
      });
    }

    const roots: LocationTreeNodeDto[] = [];
    for (const loc of allLocations) {
      const node = nodeMap.get(loc.id)!;
      if (loc.parentId && nodeMap.has(loc.parentId)) {
        nodeMap.get(loc.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async findById(orgId: string, id: string): Promise<LocationDto> {
    const location = await this.prisma.location.findFirst({
      where: { id, organizationId: orgId },
      include: {
        parent: { select: { id: true, name: true, type: true } },
        _count: { select: { children: true } },
      },
    });

    if (!location) {
      throw new NotFoundException(`Location ${id} not found`);
    }

    return {
      id: location.id,
      organizationId: location.organizationId,
      parentId: location.parentId,
      type: location.type as any,
      name: location.name,
      code: location.code,
      createdAt: location.createdAt.toISOString(),
      updatedAt: location.updatedAt.toISOString(),
      parent: location.parent ? { id: location.parent.id, name: location.parent.name, type: location.parent.type as any } : null,
      childrenCount: location._count.children,
    };
  }

  async update(orgId: string, id: string, input: UpdateLocationInput, actorId: string): Promise<LocationDto> {
    const existing = await this.prisma.location.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) {
      throw new NotFoundException(`Location ${id} not found`);
    }

    // Validate domain invariants
    new LocationEntity(
      input.name ?? existing.name,
      input.type ?? (existing.type as any),
      input.code !== undefined ? input.code : existing.code,
      input.parentId !== undefined ? input.parentId : existing.parentId,
      orgId,
      id,
    );

    // Parent change validation & cycle detection
    if (input.parentId !== undefined && input.parentId !== existing.parentId) {
      if (input.parentId) {
        const parent = await this.prisma.location.findFirst({
          where: { id: input.parentId, organizationId: orgId },
        });
        if (!parent) {
          throw new NotFoundException(`New parent location ${input.parentId} not found`);
        }

        const allLocations = await this.prisma.location.findMany({
          where: { organizationId: orgId },
          select: { id: true, parentId: true },
        });
        const parentLookup = new Map<string, string | null>(allLocations.map((l) => [l.id, l.parentId]));

        if (LocationEntity.wouldCreateCycle(id, input.parentId, parentLookup)) {
          throw new BadRequestException('Circular hierarchy detected: cannot set descendant or self as parent');
        }
      }
    }

    // Code uniqueness check
    if (input.code && input.code !== existing.code) {
      const codeConflict = await this.prisma.location.findFirst({
        where: { organizationId: orgId, code: input.code, id: { not: id } },
      });
      if (codeConflict) {
        throw new ConflictException(`Location with code "${input.code}" already exists in organization`);
      }
    }

    const updated = await this.prisma.location.update({
      where: { id },
      data: {
        name: input.name ? input.name.trim() : undefined,
        type: input.type,
        code: input.code !== undefined ? (input.code ? input.code.trim() : null) : undefined,
        parentId: input.parentId !== undefined ? input.parentId : undefined,
      },
      include: {
        parent: { select: { id: true, name: true, type: true } },
        _count: { select: { children: true } },
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'LOCATION_UPDATED',
      resourceType: 'Location',
      resourceId: id,
      metadata: { changes: input },
    });

    return this.mapToDto(updated);
  }

  async delete(orgId: string, id: string, actorId: string): Promise<{ success: boolean }> {
    const existing = await this.prisma.location.findFirst({
      where: { id, organizationId: orgId },
      include: {
        _count: {
          select: {
            children: true,
            users: true,
            sales: true,
            inventoryItems: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Location ${id} not found`);
    }

    if (existing._count.children > 0) {
      throw new BadRequestException(`Cannot delete location: has ${existing._count.children} child locations`);
    }
    if (existing._count.users > 0) {
      throw new BadRequestException(`Cannot delete location: has ${existing._count.users} assigned staff members`);
    }
    if (existing._count.sales > 0) {
      throw new BadRequestException(`Cannot delete location: has ${existing._count.sales} recorded sales transactions`);
    }
    if (existing._count.inventoryItems > 0) {
      throw new BadRequestException(`Cannot delete location: has ${existing._count.inventoryItems} active inventory records`);
    }

    await this.prisma.location.delete({ where: { id } });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'LOCATION_DELETED',
      resourceType: 'Location',
      resourceId: id,
      metadata: { name: existing.name, code: existing.code },
    });

    return { success: true };
  }

  private mapToDto(loc: any): LocationDto {
    return {
      id: loc.id,
      organizationId: loc.organizationId,
      parentId: loc.parentId,
      type: loc.type,
      name: loc.name,
      code: loc.code,
      createdAt: loc.createdAt.toISOString(),
      updatedAt: loc.updatedAt.toISOString(),
      parent: loc.parent ? { id: loc.parent.id, name: loc.parent.name, type: loc.parent.type } : null,
      childrenCount: loc._count?.children ?? 0,
    };
  }
}
