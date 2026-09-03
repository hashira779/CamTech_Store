import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { DOCUMENT_ENTITY_TYPES, ALLOWED_MIME_TYPES, type DocumentEntityType } from '@mystore/contracts';

export class CreateUploadIntentDto {
  @ApiProperty({ example: 'product_image.png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename!: string;

  @ApiProperty({ example: 'image/png', enum: ALLOWED_MIME_TYPES })
  @IsString()
  @IsIn(ALLOWED_MIME_TYPES as unknown as string[], {
    message: 'Unsupported MIME type',
  })
  mimeType!: string;

  @ApiProperty({ example: 1048576, description: 'File size in bytes (max 25MB)' })
  @IsInt()
  @IsPositive()
  byteSize!: number;

  @ApiPropertyOptional({ enum: DOCUMENT_ENTITY_TYPES })
  @IsOptional()
  @IsIn(DOCUMENT_ENTITY_TYPES as unknown as string[])
  entityType?: DocumentEntityType;

  @ApiPropertyOptional({ example: 'cuid_prod_123' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityId?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class ConfirmUploadDto {
  @ApiProperty({ example: 'cuid_doc_123' })
  @IsString()
  @IsNotEmpty()
  documentId!: string;
}

export class ListDocumentsQueryDto {
  @ApiPropertyOptional({ enum: DOCUMENT_ENTITY_TYPES })
  @IsOptional()
  @IsIn(DOCUMENT_ENTITY_TYPES as unknown as string[])
  entityType?: DocumentEntityType;

  @ApiPropertyOptional({ example: 'cuid_entity_123' })
  @IsOptional()
  @IsString()
  entityId?: string;
}
