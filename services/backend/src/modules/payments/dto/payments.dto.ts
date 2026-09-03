import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  PAYMENT_METHODS,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  type PaymentMethod,
  type PaymentProvider,
  type PaymentStatus,
} from '@mystore/contracts';

export class CreatePaymentIntentDto {
  @ApiPropertyOptional({ example: 'cuid_sale_123' })
  @IsOptional()
  @IsString()
  saleId?: string;

  @ApiProperty({ enum: PAYMENT_METHODS, default: 'QR' })
  @IsEnum(PAYMENT_METHODS)
  method!: PaymentMethod;

  @ApiPropertyOptional({ enum: PAYMENT_PROVIDERS, default: 'BAKONG_KHQR' })
  @IsOptional()
  @IsEnum(PAYMENT_PROVIDERS)
  provider?: PaymentProvider;

  @ApiProperty({ example: 45.0 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'S-2026-000042' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  billNumber?: string;

  @ApiPropertyOptional({ example: 'CAMTECH CENTRAL STORE' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  merchantName?: string;

  @ApiPropertyOptional({ example: 'Phnom Penh' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  merchantCity?: string;

  @ApiPropertyOptional({ example: 'mystore@nbc' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountInformation?: string;
}

export class PaymentWebhookDto {
  @ApiProperty({ example: 'pay_cuid_123' })
  @IsString()
  @IsNotEmpty()
  transactionId!: string;

  @ApiProperty({ enum: PAYMENT_STATUSES, example: 'COMPLETED' })
  @IsEnum(PAYMENT_STATUSES)
  status!: PaymentStatus;

  @ApiProperty({ example: 45.0 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'EXT-REF-998822' })
  @IsOptional()
  @IsString()
  externalReference?: string;

  @ApiPropertyOptional({ example: 'sha256_hash_here' })
  @IsOptional()
  @IsString()
  hash?: string;
}
