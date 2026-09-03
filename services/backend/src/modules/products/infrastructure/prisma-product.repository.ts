import { Injectable } from '@nestjs/common';
import type { Product as ProductRow, ProductVariant as ProductVariantRow } from '@prisma/client';
import type { Currency, ProductType, Unit } from '@mystore/contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Product } from '../domain/product.entity';
import type {
  ListProductsParams,
  ListProductsResult,
  ProductRepository,
} from '../domain/product.repository';

type ProductWithVariants = ProductRow & { variants: ProductVariantRow[] };

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(product: Product): Promise<Product> {
    const data = product.toPersistence();
    const variants = product.variants;

    const row = await this.prisma.product.create({
      data: {
        organizationId: data.organizationId,
        categoryId: data.categoryId,
        brandId: data.brandId,
        type: data.type,
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        variants: {
          create: variants.map((v) => {
            const vData = v.toPersistence();
            return {
              organizationId: data.organizationId, // Tenant boundary propagation
              sku: vData.sku,
              name: vData.name,
              barcode: vData.barcode,
              unit: vData.unit,
              currency: vData.currency,
              costPrice: vData.costPrice,
              sellPrice: vData.sellPrice,
              taxRatePct: vData.taxRatePct,
              isActive: vData.isActive,
            };
          }),
        },
      },
      include: { variants: true },
    });

    return this.toDomain(row);
  }

  async findBySku(organizationId: string, sku: string): Promise<Product | null> {
    // We look up the variant first
    const variantRow = await this.prisma.productVariant.findUnique({
      where: { organizationId_sku: { organizationId, sku } },
      include: { product: { include: { variants: true } } },
    });
    
    if (!variantRow) return null;
    return this.toDomain(variantRow.product);
  }

  async list(params: ListProductsParams): Promise<ListProductsResult> {
    const { organizationId, page, limit, search } = params;
    
    // Search can match Product name, or Variant SKU/name/barcode
    const where = {
      organizationId,
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { variants: { some: { sku: { contains: search } } } },
              { variants: { some: { barcode: { contains: search } } } },
              { variants: { some: { name: { contains: search } } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { variants: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  private toDomain(row: ProductWithVariants): Product {
    return Product.fromPersistence({
      id: row.id,
      organizationId: row.organizationId,
      categoryId: row.categoryId,
      brandId: row.brandId,
      type: row.type as ProductType,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      variants: row.variants.map(v => ({
        id: v.id,
        productId: v.productId,
        sku: v.sku,
        name: v.name,
        barcode: v.barcode,
        unit: v.unit as Unit,
        currency: v.currency as Currency,
        costPrice: v.costPrice.toNumber(),
        sellPrice: v.sellPrice.toNumber(),
        taxRatePct: v.taxRatePct.toNumber(),
        isActive: v.isActive,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      }))
    });
  }
}
