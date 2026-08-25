import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RechargeDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  method?: string;
}
