import { IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export const AUTOMATION_TRIGGERS = [
  'incoming_message',
  'conversation_closed',
  'custom_field_changed',
  'new_contact',
  'scheduled',
] as const;

export const AUTOMATION_STATUSES = ['draft', 'active', 'paused'] as const;

export class CreateAutomationDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsIn(AUTOMATION_STATUSES as unknown as string[])
  status?: string;
}

export class UpdateAutomationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(AUTOMATION_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsIn(AUTOMATION_TRIGGERS as unknown as string[])
  triggerType?: string;

  @IsOptional()
  @IsObject()
  triggerConfig?: Record<string, any>;

  @IsOptional()
  @IsArray()
  steps?: any[];
}
