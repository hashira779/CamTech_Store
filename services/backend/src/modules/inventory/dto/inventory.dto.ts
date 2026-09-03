import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class AdjustInventoryDto {
  @IsString()
  productVariantId!: string;

  @IsString()
  locationId!: string;

  @IsString()
  type!: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
