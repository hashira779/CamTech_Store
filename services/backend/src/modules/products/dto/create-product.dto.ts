import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PRODUCT_TYPES, ProductType, Unit, Currency, UNITS, CURRENCIES } from '@mystore/contracts';

export class CreateProductVariantDto {
  @IsString()
  @MaxLength(64)
  sku!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string | null;

  @IsOptional()
  @IsIn(UNITS)
  unit?: Unit;

  @IsOptional()
  @IsIn(CURRENCIES)
  currency?: Currency;

  @IsNumber()
  @Min(0)
  costPrice!: number;

  @IsNumber()
  @Min(0)
  sellPrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRatePct?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateProductDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsIn(PRODUCT_TYPES)
  type?: ProductType;

  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  brandId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants!: CreateProductVariantDto[];
}
