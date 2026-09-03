import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
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
import { CUSTOMER_TYPES, type CustomerType } from '@mystore/contracts';

export class CreatePriceListDto {
  @ApiProperty({ example: 'Wholesale Tier A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: 'PL-WHOLESALE-A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Code must be alphanumeric, hyphen, or underscore',
  })
  code!: string;

  @ApiPropertyOptional({ example: 'Wholesale pricing for certified distributors' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ enum: CUSTOMER_TYPES })
  @IsOptional()
  @IsEnum(CUSTOMER_TYPES)
  customerType?: CustomerType;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePriceListDto {
  @ApiPropertyOptional({ example: 'Wholesale Tier A (Updated)' })
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ enum: CUSTOMER_TYPES })
  @IsOptional()
  @IsEnum(CUSTOMER_TYPES)
  customerType?: CustomerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetPriceListItemDto {
  @ApiProperty({ example: 'cuid_variant_123' })
  @IsString()
  @IsNotEmpty()
  productVariantId!: string;

  @ApiProperty({ example: 85.5 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ example: 10, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minQuantity?: number;
}

export class ResolvePriceLineDto {
  @ApiProperty({ example: 'cuid_variant_123' })
  @IsString()
  @IsNotEmpty()
  productVariantId!: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @IsPositive()
  quantity!: number;
}

export class ResolvePricesRequestDto {
  @ApiPropertyOptional({ example: 'cuid_cust_123' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ example: 'cuid_pl_123' })
  @IsOptional()
  @IsString()
  priceListId?: string;

  @ApiProperty({ type: [ResolvePriceLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResolvePriceLineDto)
  lines!: ResolvePriceLineDto[];
}
