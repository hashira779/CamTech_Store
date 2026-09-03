import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PAYMENT_TERMS,
  type PaymentTerm,
} from '@mystore/contracts';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Beverage Distributors Co.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'SUP-001' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Code may only contain alphanumeric characters, hyphens, and underscores',
  })
  code?: string;

  @ApiPropertyOptional({ example: 'Jane Smith' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactPerson?: string;

  @ApiPropertyOptional({ example: 'orders@beveragedist.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+85512345678' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'TAX-998822' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;

  @ApiPropertyOptional({ example: 'Plot 45, Industrial Zone 2, Phnom Penh' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ enum: PAYMENT_TERMS, example: 'NET_30' })
  @IsOptional()
  @IsEnum(PAYMENT_TERMS)
  paymentTerms?: PaymentTerm;

  @ApiPropertyOptional({ example: 'Primary soda and bottled water vendor' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSupplierDto {
  @ApiPropertyOptional({ example: 'Beverage Distributors Co. (Updated)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'SUP-001' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ example: 'Jane Smith' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactPerson?: string;

  @ApiPropertyOptional({ example: 'orders@beveragedist.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+85512345678' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'TAX-998822' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;

  @ApiPropertyOptional({ example: 'Plot 45, Industrial Zone 2, Phnom Penh' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ enum: PAYMENT_TERMS, example: 'NET_30' })
  @IsOptional()
  @IsEnum(PAYMENT_TERMS)
  paymentTerms?: PaymentTerm;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class POLineItemInputDto {
  @ApiProperty({ example: 'cuid_variant_123' })
  @IsString()
  @IsNotEmpty()
  productVariantId!: string;

  @ApiProperty({ example: 50, description: 'Order quantity' })
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @ApiProperty({ example: 12.5, description: 'Agreed unit cost' })
  @IsNumber()
  @Min(0)
  unitCost!: number;

  @ApiPropertyOptional({ example: 10, default: 0, description: 'Tax rate percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRatePct?: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ example: 'cuid_supplier_123' })
  @IsString()
  @IsNotEmpty()
  supplierId!: string;

  @ApiProperty({ example: 'cuid_location_123' })
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @ApiPropertyOptional({ example: '2026-10-15T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'Urgent restocking for weekend festival' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiProperty({ type: [POLineItemInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => POLineItemInputDto)
  lineItems!: POLineItemInputDto[];
}

export class GRNLineItemInputDto {
  @ApiProperty({ example: 'cuid_po_line_123' })
  @IsString()
  @IsNotEmpty()
  poLineItemId!: string;

  @ApiProperty({ example: 'cuid_variant_123' })
  @IsString()
  @IsNotEmpty()
  productVariantId!: string;

  @ApiProperty({ example: 50, description: 'Received quantity in shipment' })
  @IsNumber()
  @IsPositive()
  quantityReceived!: number;
}

export class CreateGoodsReceiptDto {
  @ApiPropertyOptional({ example: 'Received in good condition, inspected by warehouse manager' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiProperty({ type: [GRNLineItemInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GRNLineItemInputDto)
  lineItems!: GRNLineItemInputDto[];
}
