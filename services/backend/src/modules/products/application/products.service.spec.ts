import type { AuthenticatedUser, CreateProductInput } from '@mystore/contracts';
import { ProductsService } from './products.service';
import { Product } from '../domain/product.entity';
import type { ProductRepository } from '../domain/product.repository';
import { AppError } from '../../../common/errors/app-error';

function makeActor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'user-1',
    email: 'admin@demo.test',
    name: 'Admin',
    organizationId: 'org-1',
    roles: ['ORG_ADMIN'],
    permissions: ['products.read', 'products.write'],
    ...overrides,
  };
}

function persisted(id: string, orgId: string, sku: string): Product {
  return Product.fromPersistence({
    id,
    organizationId: orgId,
    categoryId: null,
    brandId: null,
    type: 'PHYSICAL',
    name: 'Latte',
    description: null,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    variants: [
      {
        id: 'var-1',
        productId: id,
        sku,
        name: null,
        barcode: null,
        unit: 'piece',
        currency: 'USD',
        costPrice: 1,
        sellPrice: 4,
        taxRatePct: 10,
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      }
    ]
  });
}

describe('ProductsService', () => {
  let repo: jest.Mocked<ProductRepository>;
  let audit: { record: jest.Mock };
  let service: ProductsService;

  const input: CreateProductInput = {
    name: 'Latte',
    type: 'PHYSICAL',
    isActive: true,
    variants: [{
      sku: 'COF-LAT',
      unit: 'piece',
      currency: 'USD',
      costPrice: 1,
      sellPrice: 4,
      taxRatePct: 10,
      isActive: true,
    }]
  };

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      findBySku: jest.fn(),
      list: jest.fn(),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new ProductsService(repo, audit as never);
  });

  it('creates a product scoped to the actor’s organization', async () => {
    repo.findBySku.mockResolvedValue(null);
    repo.create.mockImplementation(async (p) => persisted('prod-1', p.organizationId, p.variants[0].sku));

    const actor = makeActor({ organizationId: 'org-XYZ' });
    const dto = await service.createProduct(actor, input, '127.0.0.1');

    // Tenant id came from the token, never the request body (§66/§67).
    const createdEntity = repo.create.mock.calls[0][0];
    expect(createdEntity.organizationId).toBe('org-XYZ');
    expect(dto.id).toBe('prod-1');
    expect(dto.variants[0].marginPct).toBe(75); // (4-1)/4*100
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PRODUCT_CREATED', resourceId: 'prod-1' }),
    );
  });

  it('rejects a duplicate SKU within the tenant with a stable code', async () => {
    repo.findBySku.mockResolvedValue(persisted('existing', 'org-1', 'COF-LAT'));

    await expect(service.createProduct(makeActor(), input)).rejects.toMatchObject({
      code: 'PRODUCT_SKU_EXISTS',
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('surfaces domain invariant violations', async () => {
    repo.findBySku.mockResolvedValue(null);
    await expect(
      service.createProduct(makeActor(), { ...input, variants: [{ ...input.variants[0], sellPrice: -1 }] }),
    ).rejects.toThrow(/non-negative/);
  });

  it('lists products with a hard tenant filter and correct page meta', async () => {
    repo.list.mockResolvedValue({
      items: [persisted('p1', 'org-1', 'A'), persisted('p2', 'org-1', 'B')],
      total: 25,
    });

    const result = await service.listProducts(makeActor({ organizationId: 'org-1' }), {
      page: 2,
      limit: 10,
    });

    expect(repo.list).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', page: 2, limit: 10 }),
    );
    expect(result.items).toHaveLength(2);
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
  });

  it('propagates AppError type for conflicts', async () => {
    repo.findBySku.mockResolvedValue(persisted('existing', 'org-1', 'COF-LAT'));
    await expect(service.createProduct(makeActor(), input)).rejects.toBeInstanceOf(AppError);
  });
});
