import { IsString, IsOptional, IsBoolean, IsEmail, IsIn } from 'class-validator';
import { CUSTOMER_TYPES, type CustomerType } from '@mystore/contracts';

export class CreateCustomerDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  taxId?: string | null;

  @IsOptional()
  @IsIn(CUSTOMER_TYPES)
  type?: CustomerType;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  taxId?: string | null;

  @IsOptional()
  @IsIn(CUSTOMER_TYPES)
  type?: CustomerType;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
