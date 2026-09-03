import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { FlowNode, FlowEdge } from '@mystore/contracts';

export class CreateAutomationFlowDto {
  @ApiProperty({ example: 'High-Value Order Alert to Telegram' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Automatically notifies branch managers on Telegram when sales exceed $500' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: 'EVENT', default: 'MANUAL' })
  @IsString()
  @IsNotEmpty()
  triggerType!: string;

  @ApiProperty({ isArray: true, description: 'List of graph nodes' })
  @IsArray()
  nodes!: FlowNode[];

  @ApiProperty({ isArray: true, description: 'List of directed graph edges' })
  @IsArray()
  edges!: FlowEdge[];
}

export class UpdateAutomationFlowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  triggerType?: string;

  @ApiPropertyOptional({ isArray: true })
  @IsOptional()
  @IsArray()
  nodes?: FlowNode[];

  @ApiPropertyOptional({ isArray: true })
  @IsOptional()
  @IsArray()
  edges?: FlowEdge[];
}

export class ExecuteFlowDto {
  @ApiPropertyOptional({ example: { orderId: 'ORD-1234', amount: 350.0 } })
  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;
}
