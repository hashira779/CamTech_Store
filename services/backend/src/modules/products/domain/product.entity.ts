import type { Currency, ProductDto, ProductType, ProductVariantDto, Unit } from '@mystore/contracts';

export interface ProductVariantProps {
  id: string;
  productId: string;
  sku: string;
  name: string | null;
  barcode: string | null;
  unit: Unit;
  currency: Currency;
  costPrice: number;
  sellPrice: number;
  taxRatePct: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductProps {
  id: string;
  organizationId: string;
  categoryId: string | null;
  brandId: string | null;
  type: ProductType;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  variants: ProductVariantProps[];
}

export interface NewProductVariantInput {
  sku: string;
  name?: string | null;
  barcode?: string | null;
  unit: Unit;
  currency: Currency;
  costPrice: number;
  sellPrice: number;
  taxRatePct: number;
  isActive?: boolean;
}

export interface NewProductInput {
  organizationId: string;
  categoryId?: string | null;
  brandId?: string | null;
  type: ProductType;
  name: string;
  description?: string | null;
  isActive?: boolean;
  variants: NewProductVariantInput[];
}

export class ProductVariant {
  private constructor(private readonly props: ProductVariantProps) {}

  static fromPersistence(props: ProductVariantProps): ProductVariant {
    return new ProductVariant(props);
  }

  static create(productId: string, input: NewProductVariantInput): ProductVariant {
    ProductVariant.assertInvariants(input);
    return new ProductVariant({
      id: '',
      productId,
      sku: input.sku.trim(),
      name: input.name?.trim() ? input.name.trim() : null,
      barcode: input.barcode?.trim() ? input.barcode.trim() : null,
      unit: input.unit,
      currency: input.currency,
      costPrice: input.costPrice,
      sellPrice: input.sellPrice,
      taxRatePct: input.taxRatePct,
      isActive: input.isActive ?? true,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
  }

  private static assertInvariants(input: NewProductVariantInput): void {
    if (input.costPrice < 0 || input.sellPrice < 0) {
      throw new Error('Prices must be non-negative');
    }
    if (input.taxRatePct < 0 || input.taxRatePct > 100) {
      throw new Error('Tax rate must be between 0 and 100');
    }
    if (!input.sku.trim()) {
      throw new Error('SKU is required');
    }
  }

  get marginPct(): number {
    if (this.props.sellPrice <= 0) return 0;
    const raw = ((this.props.sellPrice - this.props.costPrice) / this.props.sellPrice) * 100;
    return Math.round(raw * 100) / 100;
  }

  get sku(): string {
    return this.props.sku;
  }

  toPersistence(): Omit<ProductVariantProps, 'id' | 'productId' | 'createdAt' | 'updatedAt'> {
    const { id: _id, productId: _p, createdAt: _c, updatedAt: _u, ...rest } = this.props;
    return rest;
  }

  toDto(): ProductVariantDto {
    return {
      id: this.props.id,
      productId: this.props.productId,
      sku: this.props.sku,
      name: this.props.name,
      barcode: this.props.barcode,
      unit: this.props.unit,
      currency: this.props.currency,
      costPrice: this.props.costPrice,
      sellPrice: this.props.sellPrice,
      taxRatePct: this.props.taxRatePct,
      marginPct: this.marginPct,
      isActive: this.props.isActive,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }
}

export class Product {
  private constructor(
    private readonly props: Omit<ProductProps, 'variants'>,
    private readonly _variants: ProductVariant[],
  ) {}

  static fromPersistence(props: ProductProps): Product {
    const { variants, ...rest } = props;
    return new Product(
      rest,
      variants.map((v) => ProductVariant.fromPersistence(v)),
    );
  }

  static create(input: NewProductInput): Product {
    if (!input.name.trim()) throw new Error('Product name is required');
    if (!input.variants || input.variants.length === 0) {
      throw new Error('Product must have at least one variant');
    }

    const masterProps = {
      id: '',
      organizationId: input.organizationId,
      categoryId: input.categoryId || null,
      brandId: input.brandId || null,
      type: input.type,
      name: input.name.trim(),
      description: input.description?.trim() ? input.description.trim() : null,
      isActive: input.isActive ?? true,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };

    const variants = input.variants.map((v) => ProductVariant.create('', v));
    return new Product(masterProps, variants);
  }

  get id(): string {
    return this.props.id;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get variants(): ProductVariant[] {
    return this._variants;
  }

  toPersistence(): Omit<ProductProps, 'id' | 'createdAt' | 'updatedAt' | 'variants'> {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = this.props;
    return rest;
  }

  toDto(): ProductDto {
    return {
      id: this.props.id,
      organizationId: this.props.organizationId,
      categoryId: this.props.categoryId,
      brandId: this.props.brandId,
      type: this.props.type,
      name: this.props.name,
      description: this.props.description,
      isActive: this.props.isActive,
      variants: this._variants.map((v) => v.toDto()),
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }
}
