import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PROMOTION_TYPES,
  PROMOTION_SCOPES,
  CUSTOMER_TYPES,
  type PromotionType,
  type PromotionScope,
  type CustomerType,
} from '@mystore/contracts';

export class CreatePromotionDto {
  @ApiProperty({ example: 'Summer Clearance 20%' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: 'SUMMER20' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Promo code may only contain alphanumeric characters, hyphens, and underscores',
  })
  code?: string;

  @ApiPropertyOptional({ example: '20% off all orders over $50' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ enum: PROMOTION_TYPES, example: 'PERCENTAGE' })
  @IsEnum(PROMOTION_TYPES)
  type!: PromotionType;

  @ApiPropertyOptional({ enum: PROMOTION_SCOPES, example: 'ORDER', default: 'ORDER' })
  @IsOptional()
  @IsEnum(PROMOTION_SCOPES)
  scope?: PromotionScope;

  @ApiProperty({ example: 20, description: 'Percentage rate or fixed dollar amount' })
  @IsNumber()
  @Min(0)
  discountValue!: number;

  @ApiPropertyOptional({ example: 50, description: 'Minimum cart subtotal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({ example: 30, description: 'Maximum dollar discount cap' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountAmount?: number;

  @ApiPropertyOptional({ example: 2, description: 'Buy quantity for BUY_X_GET_Y' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  buyQuantity?: number;

  @ApiPropertyOptional({ example: 1, description: 'Get quantity for BUY_X_GET_Y' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  getQuantity?: number;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-08-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 500, description: 'Maximum total redemptions' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  usageLimit?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Target product variant IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetVariantIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Target category IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetCategoryIds?: string[];

  @ApiPropertyOptional({ enum: CUSTOMER_TYPES, isArray: true })
  @IsOptional()
  @IsArray()
  customerTypes?: CustomerType[];
}

export class UpdatePromotionDto {
  @ApiPropertyOptional({ example: 'Summer Clearance 20% (Extended)' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ enum: PROMOTION_TYPES })
  @IsOptional()
  @IsEnum(PROMOTION_TYPES)
  type?: PromotionType;

  @ApiPropertyOptional({ enum: PROMOTION_SCOPES })
  @IsOptional()
  @IsEnum(PROMOTION_SCOPES)
  scope?: PromotionScope;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  buyQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  getQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  usageLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CartLineForEvalDto {
  @ApiProperty({ example: 'cuid_variant_123' })
  @IsString()
  @IsNotEmpty()
  productVariantId!: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @ApiProperty({ example: 25.5 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ example: 'cuid_cat_123' })
  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class EvaluatePromotionDto {
  @ApiProperty({ example: 'SUMMER20' })
  @IsString()
  @IsNotEmpty()
  promoCode!: string;

  @ApiProperty({ type: [CartLineForEvalDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartLineForEvalDto)
  lines!: CartLineForEvalDto[];

  @ApiPropertyOptional({ example: 'cuid_customer_123' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ enum: CUSTOMER_TYPES, example: 'INDIVIDUAL' })
  @IsOptional()
  @IsEnum(CUSTOMER_TYPES)
  customerType?: CustomerType;
}
