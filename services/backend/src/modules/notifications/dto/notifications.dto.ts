import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
  type NotificationChannel,
  type NotificationType,
} from '@mystore/contracts';

export class SendNotificationDto {
  @ApiPropertyOptional({ enum: NOTIFICATION_CHANNELS, default: 'IN_APP' })
  @IsOptional()
  @IsIn(NOTIFICATION_CHANNELS as unknown as string[])
  channel?: NotificationChannel;

  @ApiPropertyOptional({ enum: NOTIFICATION_TYPES, default: 'GENERAL' })
  @IsOptional()
  @IsIn(NOTIFICATION_TYPES as unknown as string[])
  type?: NotificationType;

  @ApiProperty({ example: 'Low Stock Alert: Organic Arabica Beans' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'Inventory count dropped below reorder point (5 remaining).' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional({ example: 'cuid_user_123' })
  @IsOptional()
  @IsString()
  recipientUserId?: string;

  @ApiPropertyOptional({ example: { productId: 'prod_123', stock: 5 } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateNotificationConfigDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  telegramEnabled?: boolean;

  @ApiPropertyOptional({ example: '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  telegramBotToken?: string;

  @ApiPropertyOptional({ example: '-1001234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  telegramChatId?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({ example: 'manager@mystore.com' })
  @IsOptional()
  @IsString()
  emailRecipient?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;
}

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ enum: NOTIFICATION_CHANNELS })
  @IsOptional()
  @IsIn(NOTIFICATION_CHANNELS as unknown as string[])
  channel?: NotificationChannel;

  @ApiPropertyOptional({ enum: NOTIFICATION_TYPES })
  @IsOptional()
  @IsIn(NOTIFICATION_TYPES as unknown as string[])
  type?: NotificationType;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
