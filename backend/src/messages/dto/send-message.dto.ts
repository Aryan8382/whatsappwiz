import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class SendTextDto {
  @IsNumber()
  whatsappNumberId: number;

  @IsString()
  to: string;

  @IsString()
  text: string;
}

export class SendTemplateDto {
  @IsNumber()
  whatsappNumberId: number;

  @IsString()
  to: string;

  @IsString()
  templateName: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  parameters?: string[];
}

export class SendMediaDto {
  @IsNumber()
  whatsappNumberId: number;

  @IsString()
  to: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  caption?: string;
}

export class RunBotReplyDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsNumber()
  botId?: number;
}
