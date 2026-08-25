import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateFlowDto {
  @IsString()
  name: string;
}

export class AddNodeDto {
  @IsString()
  nodeType: string;

  @IsOptional()
  @IsObject()
  config?: any;

  @IsOptional()
  @IsNumber()
  positionX?: number;

  @IsOptional()
  @IsNumber()
  positionY?: number;
}

export class UpdateNodeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  config?: any;

  @IsOptional()
  @IsNumber()
  positionX?: number;

  @IsOptional()
  @IsNumber()
  positionY?: number;
}

export class ConnectDto {
  @IsNumber()
  sourceNode: number;

  @IsNumber()
  targetNode: number;
}

export class UpdateBotConfigDto {
  @IsOptional()
  @IsObject()
  config?: any;
}

export class UpdateFlowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  config?: any;
}

