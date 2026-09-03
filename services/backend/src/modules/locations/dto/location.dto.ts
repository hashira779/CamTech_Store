import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { LOCATION_TYPES, type LocationType } from '@mystore/contracts';

export class CreateLocationDto {
  @ApiProperty({ example: 'Downtown Supermarket', description: 'Location name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: LOCATION_TYPES, example: 'BRANCH', description: 'Hierarchy level' })
  @IsEnum(LOCATION_TYPES)
  type!: LocationType;

  @ApiPropertyOptional({ example: 'BR-DOWNTOWN', description: 'Unique code in organization' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Code may only contain alphanumeric characters, hyphens, and underscores',
  })
  code?: string;

  @ApiPropertyOptional({ example: 'cuid_parent_123', description: 'Parent location ID' })
  @IsOptional()
  @IsString()
  parentId?: string;
}

export class UpdateLocationDto {
  @ApiPropertyOptional({ example: 'Downtown Supermarket (Renamed)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: LOCATION_TYPES, example: 'BRANCH' })
  @IsOptional()
  @IsEnum(LOCATION_TYPES)
  type?: LocationType;

  @ApiPropertyOptional({ example: 'BR-DOWNTOWN-NEW' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Code may only contain alphanumeric characters, hyphens, and underscores',
  })
  code?: string;

  @ApiPropertyOptional({ example: 'cuid_parent_456', description: 'New parent location ID or null to make root' })
  @IsOptional()
  @IsString()
  parentId?: string | null;
}
