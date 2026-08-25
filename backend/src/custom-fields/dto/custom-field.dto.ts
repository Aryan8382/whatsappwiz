import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export const CUSTOM_FIELD_TYPES = [
  'text',
  'number',
  'date',
  'dropdown',
  'boolean',
  'email',
  'phone',
] as const;

export class CreateCustomFieldDto {
  @IsString()
  name: string;

  @IsIn(CUSTOM_FIELD_TYPES as unknown as string[])
  fieldType: string;

  @IsOptional()
  @IsString()
  defaultValue?: string;

  @IsOptional()
  @IsArray()
  options?: string[];

  @IsOptional()
  @IsBoolean()
  showInListing?: boolean;

  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;
}

export class UpdateCustomFieldDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(CUSTOM_FIELD_TYPES as unknown as string[])
  fieldType?: string;

  @IsOptional()
  @IsString()
  defaultValue?: string;

  @IsOptional()
  @IsArray()
  options?: string[];

  @IsOptional()
  @IsBoolean()
  showInListing?: boolean;

  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;
}
