import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
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

export class CreateTaxRateDto {
  @ApiProperty({ example: 'VAT-10' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'Tax code must contain uppercase letters, numbers, hyphens or underscores',
  })
  code!: string;

  @ApiProperty({ example: 'Standard Value Added Tax 10%' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 10.0 })
  @IsNumber()
  @Min(0)
  @Max(100)
  ratePct!: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isInclusive?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isCompound?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTaxRateDto {
  @ApiPropertyOptional({ example: 'Standard Value Added Tax 10%' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 10.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ratePct?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isInclusive?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isCompound?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TaxCalculationLineDto {
  @ApiProperty({ example: 100.0 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiProperty({ example: 10.0, default: 0 })
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRatePct!: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isInclusive?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isCompound?: boolean;
}

export class CalculateTaxesInputDto {
  @ApiProperty({ type: [TaxCalculationLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxCalculationLineDto)
  lines!: TaxCalculationLineDto[];
}
