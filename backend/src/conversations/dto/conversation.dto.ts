import { IsNumber, IsOptional, IsString } from 'class-validator';

export class AssignDto {
  @IsNumber()
  agentId: number;
}

export class NoteDto {
  @IsString()
  note: string;
}

export class SetStatusDto {
  @IsString()
  status: string;
}

export class LabelDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsNumber()
  labelId?: number;
}
