import { IsOptional, IsString } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  header?: string;

  @IsOptional()
  @IsString()
  headerMediaUrl?: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  footer?: string;

  @IsOptional()
  buttons?: any;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  header?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  footer?: string;

  @IsOptional()
  buttons?: any;
}
