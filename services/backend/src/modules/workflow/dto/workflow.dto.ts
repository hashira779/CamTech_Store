import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  WORKFLOW_ENTITY_TYPES,
  type WorkflowEntityType,
} from '@mystore/contracts';

export class CreateWorkflowStepDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  stepOrder!: number;

  @ApiProperty({ example: 'Finance Manager Approval' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'FINANCE_MANAGER' })
  @IsOptional()
  @IsString()
  assignedRole?: string;

  @ApiPropertyOptional({ example: 'user_cuid_123' })
  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class SubmitApprovalDto {
  @ApiProperty({ enum: WORKFLOW_ENTITY_TYPES, example: 'PURCHASE_ORDER' })
  @IsIn(WORKFLOW_ENTITY_TYPES as unknown as string[])
  entityType!: WorkflowEntityType;

  @ApiProperty({ example: 'po_cuid_123' })
  @IsString()
  @IsNotEmpty()
  entityId!: string;

  @ApiProperty({ example: 'Approve PO-2026-00042 ($4,500)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ type: [CreateWorkflowStepDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStepDto)
  steps?: CreateWorkflowStepDto[];
}

export class ReviewWorkflowStepDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'], example: 'APPROVE' })
  @IsIn(['APPROVE', 'REJECT'])
  action!: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional({ example: 'Approved within department quarterly budget' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
