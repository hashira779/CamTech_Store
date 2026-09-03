import { Product } from './product.entity';

export interface ListProductsParams {
  organizationId: string;
  page: number;
  limit: number;
  search?: string;
}

export interface ListProductsResult {
  items: Product[];
  total: number;
}

/**
 * Repository port (spec §4). The domain/application layer depends on THIS
 * interface, never on Prisma. The Prisma implementation is bound to the token
 * in products.module.ts, and swapped freely in tests.
 */
export interface ProductRepository {
  create(product: Product): Promise<Product>;
  findBySku(organizationId: string, sku: string): Promise<Product | null>;
  list(params: ListProductsParams): Promise<ListProductsResult>;
}

/** DI token for the repository port. */
export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
