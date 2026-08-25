import { IsOptional, IsString } from 'class-validator';

export class ConnectWabaDto {
  @IsString()
  businessId: string;

  @IsString()
  wabaId: string;

  @IsString()
  phoneNumberId: string;

  @IsString()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}
