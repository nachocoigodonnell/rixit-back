import { IsString, IsNumber, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateGameDto {
  @IsString()
  @IsNotEmpty()
  playerName!: string;

  @IsNumber()
  @IsNotEmpty()
  playerCount!: number;
  
  @IsString()
  @IsOptional()
  code?: string;
  
  @IsString()
  @IsOptional()
  stage?: string;
} 