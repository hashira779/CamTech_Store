import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ACCOUNT_TYPES,
  JOURNAL_SOURCE_TYPES,
  type AccountType,
  type JournalSourceType,
} from '@mystore/contracts';

export class CreateAccountDto {
  @ApiProperty({ example: '1010', description: 'Account code in Chart of Accounts' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @ApiProperty({ example: 'Cash on Hand', description: 'Account display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: ACCOUNT_TYPES, example: 'ASSET' })
  @IsIn(ACCOUNT_TYPES as unknown as string[])
  type!: AccountType;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'Primary physical register till cash' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}

export class UpdateAccountDto {
  @ApiPropertyOptional({ example: 'Operating Cash on Hand' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class JournalLineItemDto {
  @ApiProperty({ example: 'cuid_account_123' })
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @ApiProperty({ example: 100.0, default: 0 })
  @IsNumber()
  @Min(0)
  debit!: number;

  @ApiProperty({ example: 0.0, default: 0 })
  @IsNumber()
  @Min(0)
  credit!: number;

  @ApiPropertyOptional({ example: 'Settlement for invoice #1001' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  memo?: string;
}

export class CreateJournalEntryDto {
  @ApiPropertyOptional({ example: '2026-09-01T12:00:00Z' })
  @IsOptional()
  @IsISO8601()
  postingDate?: string;

  @ApiPropertyOptional({ enum: JOURNAL_SOURCE_TYPES, default: 'MANUAL' })
  @IsOptional()
  @IsIn(JOURNAL_SOURCE_TYPES as unknown as string[])
  sourceType?: JournalSourceType;

  @ApiPropertyOptional({ example: 'sale_cuid_123' })
  @IsOptional()
  @IsString()
  sourceId?: string;

  @ApiProperty({ example: 'Monthly store rental payment' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ type: [JournalLineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalLineItemDto)
  lines!: JournalLineItemDto[];
}

export class FinancialStatementQueryDto {
  @ApiPropertyOptional({ example: '2026-09-01T00:00:00Z' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-09-30T23:59:59Z' })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({ example: '2026-09-30T23:59:59Z' })
  @IsOptional()
  @IsISO8601()
  asOfDate?: string;
}
