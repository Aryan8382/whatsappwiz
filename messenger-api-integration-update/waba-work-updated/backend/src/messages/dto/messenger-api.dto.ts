import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMessengerUserDto {
  @IsOptional()
  @IsString()
  user_type?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsString()
  currencies?: string;

  @IsOptional()
  @IsString()
  webhook_forwarding_url?: string;

  @IsString()
  @IsNotEmpty()
  phone: string;
}

export class UpdateMessengerProfileDto {
  @IsOptional()
  @IsString()
  whatsAppAbout?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  vertical?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  websites?: string[];

  @IsOptional()
  @IsString()
  profile_picture_handle?: string;
}

export class MarkAsReadDto {
  @IsString()
  @IsNotEmpty()
  message_id: string;
}

export class SendReplyButtonsDto {
  @IsString()
  to: string;

  @IsString()
  bodyText: string;

  @IsArray()
  buttons: { id: string; title: string }[];

  @IsOptional()
  @IsString()
  header?: string;

  @IsOptional()
  @IsString()
  footer?: string;
}

export class SendCtaUrlDto {
  @IsString()
  to: string;

  @IsString()
  displayText: string;

  @IsString()
  url: string;

  @IsString()
  bodyText: string;

  @IsOptional()
  @IsString()
  header?: string;

  @IsOptional()
  @IsString()
  footer?: string;
}

class ListRowDto {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class ListSectionDto {
  @IsString()
  title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ListRowDto)
  rows: ListRowDto[];
}

export class SendListMessageDto {
  @IsString()
  to: string;

  @IsString()
  bodyText: string;

  @IsString()
  buttonText: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ListSectionDto)
  sections: ListSectionDto[];

  @IsOptional()
  @IsString()
  header?: string;

  @IsOptional()
  @IsString()
  footer?: string;
}

export class SendAddressMessageDto {
  @IsString()
  to: string;

  @IsString()
  bodyText: string;

  @IsString()
  country: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

export class SendLocationMessageDto {
  @IsString()
  to: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class SendFlowMessageDto {
  @IsString()
  to: string;

  @IsOptional()
  @IsString()
  headerText?: string;

  @IsString()
  bodyText: string;

  @IsOptional()
  @IsString()
  footerText?: string;

  @IsString()
  flowToken: string;

  @IsString()
  flowId: string;

  @IsString()
  flowCta: string;

  @IsOptional()
  @IsString()
  flowAction?: 'navigate' | 'data_exchange';

  @IsOptional()
  flowActionPayload?: any;
}

export class SendAudioDto {
  @IsString()
  to: string;

  @IsString()
  audioLinkOrId: string;
}

export class SendReplyDto {
  @IsString()
  to: string;

  @IsString()
  contextMessageId: string;

  @IsString()
  text: string;

  @IsOptional()
  previewUrl?: boolean;
}

class CarouselCardDto {
  @IsString()
  imageLink: string;

  @IsArray()
  @IsString({ each: true })
  bodyParams: string[];
}

export class SendCarouselTemplateDto {
  @IsString()
  to: string;

  @IsString()
  templateName: string;

  @IsOptional()
  @IsString()
  languageCode?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bodyParams?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CarouselCardDto)
  cards: CarouselCardDto[];
}

export class SendCouponTemplateDto {
  @IsString()
  to: string;

  @IsString()
  templateName: string;

  @IsOptional()
  @IsString()
  languageCode?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bodyParams?: string[];

  @IsString()
  couponCode: string;

  @IsOptional()
  @IsNumber()
  buttonIndex?: number;
}

export class SendFlowsTemplateDto {
  @IsString()
  to: string;

  @IsString()
  templateName: string;

  @IsOptional()
  @IsString()
  languageCode?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bodyParams?: string[];

  @IsOptional()
  @IsString()
  flowToken?: string;

  @IsOptional()
  @IsString()
  buttonIndex?: string;
}

export class RegisterWebhookDto {
  @IsString()
  @IsNotEmpty()
  url: string;
}
