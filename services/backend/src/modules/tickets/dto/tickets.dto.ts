import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from '@mystore/contracts';

export class CreateServiceTicketDto {
  @ApiProperty({ example: 'POS Receipt Printer Jammed at Register 2' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @ApiProperty({ example: 'Paper feed gear seems stuck. Cashier cannot print receipts.' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ enum: TICKET_PRIORITIES, default: 'MEDIUM' })
  @IsOptional()
  @IsIn(TICKET_PRIORITIES as unknown as string[])
  priority?: TicketPriority;

  @ApiPropertyOptional({ example: 'HARDWARE' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'tech_user_123' })
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional({ example: 'cust_cuid_123' })
  @IsOptional()
  @IsString()
  customerId?: string;
}

export class AddTicketCommentDto {
  @ApiProperty({ example: 'Replacement thermal head ordered from supplier.' })
  @IsString()
  @IsNotEmpty()
  comment!: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}

export class UpdateTicketStatusDto {
  @ApiProperty({ enum: TICKET_STATUSES, example: 'RESOLVED' })
  @IsIn(TICKET_STATUSES as unknown as string[])
  status!: TicketStatus;

  @ApiPropertyOptional({ example: 'Replaced thermal roller and tested print output.' })
  @IsOptional()
  @IsString()
  resolution?: string;
}
