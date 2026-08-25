import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export const FLOW_CATEGORIES = [
  'SIGN_UP',
  'SIGN_IN',
  'APPOINTMENT_BOOKING',
  'LEAD_GENERATION',
  'CONTACT_US',
  'CUSTOMER_SUPPORT',
  'SURVEY',
  'OTHER',
] as const;

export class CreateFlowDto {
  @IsString()
  name: string;

  @IsIn(FLOW_CATEGORIES as unknown as string[])
  category: string;
}

export class UpdateFlowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(FLOW_CATEGORIES as unknown as string[])
  category?: string;

  @IsOptional()
  @IsArray()
  screens?: any[];
}
