import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BUSINESS_TYPES, type BusinessType } from '@mystore/contracts';

export class UpdateOrganizationSettingsDto {
  @ApiPropertyOptional({ example: 'USD', description: 'Base currency code (USD, KHR, etc.)' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  currency?: string;

  @ApiPropertyOptional({ example: 'Asia/Phnom_Penh', description: 'Default timezone' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @ApiPropertyOptional({ example: 10, description: 'Default VAT / Sales tax percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRatePct?: number;

  @ApiPropertyOptional({ enum: BUSINESS_TYPES, example: 'RETAIL' })
  @IsOptional()
  @IsEnum(BUSINESS_TYPES)
  businessType?: BusinessType;

  @ApiPropertyOptional({
    example: ['products', 'customers', 'sales', 'inventory', 'locations'],
    description: 'Active enterprise feature modules',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledModules?: string[];

  @ApiPropertyOptional({ example: 'Thank you for shopping at MyStore!' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  receiptHeader?: string;

  @ApiPropertyOptional({ example: 'Goods sold are exchangeable within 7 days.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  receiptFooter?: string;
}
