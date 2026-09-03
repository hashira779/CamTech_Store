import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser, CreateProductInput, Paginated, ProductDto } from '@mystore/contracts';
import { AppError } from '../../../common/errors/app-error';
import { AuditService } from '../../audit/audit.service';
import { Product } from '../domain/product.entity';
import {
  PRODUCT_REPOSITORY,
  type ListProductsParams,
  type ProductRepository,
} from '../domain/product.repository';

interface ListInput {
  page: number;
  limit: number;
  search?: string;
}

@Injectable()
export class ProductsService {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    private readonly audit: AuditService,
  ) {}

  async createProduct(
    actor: AuthenticatedUser,
    input: CreateProductInput,
    ip?: string,
  ): Promise<ProductDto> {
    
    // Validate uniqueness of all provided SKUs across variants
    for (const v of input.variants) {
      const existing = await this.products.findBySku(actor.organizationId, v.sku);
      if (existing) {
        throw AppError.conflict(
          'PRODUCT_SKU_EXISTS',
          `A product with SKU "${v.sku}" already exists`,
        );
      }
    }

    const entity = Product.create({
      organizationId: actor.organizationId,
      categoryId: input.categoryId,
      brandId: input.brandId,
      type: input.type,
      name: input.name,
      description: input.description,
      isActive: input.isActive,
      variants: input.variants.map((v) => ({
        sku: v.sku,
        name: v.name,
        barcode: v.barcode,
        unit: v.unit,
        currency: v.currency,
        costPrice: v.costPrice,
        sellPrice: v.sellPrice,
        taxRatePct: v.taxRatePct,
        isActive: v.isActive,
      })),
    });

    const saved = await this.products.create(entity);

    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'PRODUCT_CREATED',
      resourceType: 'Product',
      resourceId: saved.id,
      ip,
      metadata: { name: saved.toDto().name, variantsCount: saved.variants.length },
    });

    return saved.toDto();
  }

  async listProducts(actor: AuthenticatedUser, input: ListInput): Promise<Paginated<ProductDto>> {
    const params: ListProductsParams = {
      organizationId: actor.organizationId, // hard tenant filter
      page: input.page,
      limit: input.limit,
      search: input.search,
    };
    const { items, total } = await this.products.list(params);
    const totalPages = Math.max(1, Math.ceil(total / input.limit));
    return {
      items: items.map((p) => p.toDto()),
      meta: { page: input.page, limit: input.limit, total, totalPages },
    };
  }
}
