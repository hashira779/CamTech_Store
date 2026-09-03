import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateLoyaltyConfigDto {
  @ApiPropertyOptional({ example: 1.0, description: 'Points earned per $1 spent' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  earnRate?: number;

  @ApiPropertyOptional({ example: 0.01, description: 'Dollar discount per 1 point' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  redeemRate?: number;

  @ApiPropertyOptional({ example: 50, description: 'Minimum points required to redeem' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minPointsRedeem?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdjustLoyaltyPointsDto {
  @ApiProperty({ example: 'cuid_customer_123' })
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @ApiProperty({ example: 100, description: 'Positive to add points, negative to deduct' })
  @IsInt()
  points!: number;

  @ApiPropertyOptional({ example: 'Customer service goodwill adjustment' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AdjustStoreCreditDto {
  @ApiProperty({ example: 'cuid_customer_123' })
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @ApiProperty({ example: 25.5, description: 'Positive to add credit, negative to deduct' })
  @IsNumber()
  amount!: number;

  @ApiPropertyOptional({ example: 'Gift card manual issuance' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RedeemLoyaltyPointsDto {
  @ApiProperty({ example: 'cuid_customer_123' })
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @ApiProperty({ example: 100 })
  @IsInt()
  @IsPositive()
  points!: number;
}
