import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  API_SCOPES,
  WEBHOOK_EVENTS,
  type ApiScope,
  type WebhookEvent,
} from '@mystore/contracts';

export class CreateDeveloperAppDto {
  @ApiProperty({ example: 'ERP Connector App' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Integration bridge with external SAP system' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://partner.enterprise.com' })
  @IsOptional()
  @IsUrl()
  homepageUrl?: string;
}

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Production Order Sync Key' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'app_cuid_123' })
  @IsOptional()
  @IsString()
  appId?: string;

  @ApiProperty({
    enum: API_SCOPES,
    isArray: true,
    example: ['products:read', 'sales:read', 'sales:write'],
  })
  @IsArray()
  @IsIn(API_SCOPES as unknown as string[], { each: true })
  scopes!: ApiScope[];

  @ApiPropertyOptional({ example: 60, default: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  rateLimit?: number;

  @ApiPropertyOptional({ example: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}

export class CreateWebhookSubscriptionDto {
  @ApiProperty({ example: 'https://webhook.site/test-endpoint' })
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiPropertyOptional({ example: 'Fulfillment & Logistics Event Listener' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: WEBHOOK_EVENTS,
    isArray: true,
    example: ['order.created', 'order.paid', 'inventory.low_stock'],
  })
  @IsArray()
  @IsIn(WEBHOOK_EVENTS as unknown as string[], { each: true })
  events!: WebhookEvent[];
}
