import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  STOCK_TRANSFER_STATUSES,
  WAREHOUSE_ZONE_TYPES,
  type StockTransferStatus,
  type WarehouseZoneType,
} from '@mystore/contracts';

export class CreateWarehouseZoneDto {
  @ApiProperty({ example: 'cuid_loc_123' })
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @ApiProperty({ example: 'ZONE-A' })
  @IsString()
  @MaxLength(20)
  code!: string;

  @ApiProperty({ example: 'Main Inbound Storage' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ enum: WAREHOUSE_ZONE_TYPES, default: 'STORAGE' })
  @IsOptional()
  @IsEnum(WAREHOUSE_ZONE_TYPES)
  type?: WarehouseZoneType;
}

export class CreateWarehouseBinDto {
  @ApiProperty({ example: 'cuid_zone_123' })
  @IsString()
  @IsNotEmpty()
  zoneId!: string;

  @ApiProperty({ example: 'A-01-02-B' })
  @IsString()
  @MaxLength(30)
  code!: string;

  @ApiPropertyOptional({ example: 'BIN-BARCODE-999' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  barcode?: string;

  @ApiPropertyOptional({ example: 500.0 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  maxWeightKg?: number;

  @ApiPropertyOptional({ example: 2.5 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  maxVolumeCbm?: number;
}

export class CreateProductBatchDto {
  @ApiProperty({ example: 'cuid_variant_123' })
  @IsString()
  @IsNotEmpty()
  productVariantId!: string;

  @ApiProperty({ example: 'BATCH-2026-001' })
  @IsString()
  @MaxLength(50)
  batchNumber!: string;

  @ApiPropertyOptional({ example: 'LOT-992' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lotNumber?: string;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00Z' })
  @IsOptional()
  @IsString()
  manufacturedAt?: string;

  @ApiProperty({ example: '2027-01-01T00:00:00Z' })
  @IsString()
  @IsNotEmpty()
  expiresAt!: string;

  @ApiPropertyOptional({ example: 100, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityOnHand?: number;

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;
}

export class StockTransferLineInputDto {
  @ApiProperty({ example: 'cuid_variant_123' })
  @IsString()
  @IsNotEmpty()
  productVariantId!: string;

  @ApiProperty({ example: 25 })
  @IsNumber()
  @IsPositive()
  requestedQty!: number;

  @ApiPropertyOptional({ example: 'BATCH-2026-001' })
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiPropertyOptional({ example: 'cuid_bin_1' })
  @IsOptional()
  @IsString()
  sourceBinId?: string;

  @ApiPropertyOptional({ example: 'cuid_bin_2' })
  @IsOptional()
  @IsString()
  destBinId?: string;
}

export class CreateStockTransferDto {
  @ApiProperty({ example: 'cuid_loc_source' })
  @IsString()
  @IsNotEmpty()
  sourceLocationId!: string;

  @ApiProperty({ example: 'cuid_loc_dest' })
  @IsString()
  @IsNotEmpty()
  destinationLocationId!: string;

  @ApiPropertyOptional({ example: 'Urgent weekend restocking' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({ type: [StockTransferLineInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockTransferLineInputDto)
  lines!: StockTransferLineInputDto[];
}

export class UpdateStockTransferStatusDto {
  @ApiProperty({ enum: STOCK_TRANSFER_STATUSES, example: 'APPROVED' })
  @IsEnum(STOCK_TRANSFER_STATUSES)
  status!: StockTransferStatus;

  @ApiPropertyOptional({ example: 'Approved by warehouse manager' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ReceiveStockTransferLineDto {
  @ApiProperty({ example: 'cuid_line_123' })
  @IsString()
  @IsNotEmpty()
  lineId!: string;

  @ApiProperty({ example: 25 })
  @IsNumber()
  @Min(0)
  receivedQty!: number;

  @ApiPropertyOptional({ example: 'cuid_bin_dest' })
  @IsOptional()
  @IsString()
  destBinId?: string;
}

export class ReceiveStockTransferDto {
  @ApiProperty({ type: [ReceiveStockTransferLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveStockTransferLineDto)
  lines!: ReceiveStockTransferLineDto[];

  @ApiPropertyOptional({ example: 'All items in good condition' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
