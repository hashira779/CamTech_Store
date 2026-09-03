import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';

class SaleLineItemInputDto {
  @IsString()
  productVariantId!: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;
}

class SalePaymentInputDto {
  @IsString()
  method!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  reference?: string | null;
}

export class CreateSaleDto {
  @IsOptional()
  @IsString()
  customerId?: string | null;

  @IsOptional()
  @IsString()
  locationId?: string | null;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsString()
  idempotencyKey?: string | null;

  @IsOptional()
  @IsString()
  promoCode?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleLineItemInputDto)
  lineItems!: SaleLineItemInputDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalePaymentInputDto)
  payments!: SalePaymentInputDto[];
}

export class OfflineSalePayloadDto extends CreateSaleDto {
  @IsString()
  localId!: string;

  @IsString()
  clientCreatedAt!: string;
}

export class SyncBatchRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfflineSalePayloadDto)
  sales!: OfflineSalePayloadDto[];
}
