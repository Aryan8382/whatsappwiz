import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  name: string;

  @IsNumber()
  templateId: number;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  tagIds?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  segmentIds?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  contactIds?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  phoneNumbers?: string[];

  @IsOptional()
  @IsNumber()
  ratePerMinute?: number;
}
