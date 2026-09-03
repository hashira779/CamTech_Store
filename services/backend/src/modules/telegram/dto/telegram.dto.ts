import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class BindTelegramChatDto {
  @ApiProperty({ example: '-1001234567890' })
  @IsString()
  @IsNotEmpty()
  chatId!: string;

  @ApiPropertyOptional({ example: 'Retail Operations Managers Group' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  chatTitle?: string;

  @ApiPropertyOptional({ example: 'john_manager' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ example: 'BRANCH_MANAGER', default: 'OPERATOR' })
  @IsOptional()
  @IsString()
  role?: string;
}

export class SendTelegramBroadcastDto {
  @ApiProperty({ example: '⚠️ Attention: POS terminal at Branch 2 requires tape replenishment.' })
  @IsString()
  @IsNotEmpty()
  message!: string;
}

export class TelegramWebhookPayloadDto {
  @ApiPropertyOptional()
  @IsOptional()
  update_id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  message?: {
    message_id: number;
    chat: {
      id: number | string;
      title?: string;
      type: string;
    };
    from?: {
      id: number;
      first_name?: string;
      username?: string;
    };
    text?: string;
    date: number;
  };
}
