import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  IsPositive,
} from 'class-validator';
import {
  DEPRECIATION_METHODS,
  type DepreciationMethod,
} from '@mystore/contracts';

export class CreateFixedAssetDto {
  @ApiProperty({ example: 'FA-0010' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  assetCode!: string;

  @ApiProperty({ example: 'Epson TM-T88VI POS Receipt Printer' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'EQUIPMENT' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  category!: string;

  @ApiProperty({ example: '2026-01-01T00:00:00Z' })
  @IsISO8601()
  purchaseDate!: string;

  @ApiProperty({ example: 450.0 })
  @IsNumber()
  @IsPositive()
  purchaseCost!: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salvageValue?: number;

  @ApiPropertyOptional({ example: 36, default: 60 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  usefulLifeMonths?: number;

  @ApiPropertyOptional({ enum: DEPRECIATION_METHODS, default: 'STRAIGHT_LINE' })
  @IsOptional()
  @IsIn(DEPRECIATION_METHODS as unknown as string[])
  depreciationMethod?: DepreciationMethod;

  @ApiPropertyOptional({ example: 'loc_cuid_123' })
  @IsOptional()
  @IsString()
  locationId?: string;
}
