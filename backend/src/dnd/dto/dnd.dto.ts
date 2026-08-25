import { IsOptional, IsString } from 'class-validator';

export class CreateDndDto {
  @IsString()
  number: string;

  @IsOptional()
  @IsString()
  message?: string;
}
