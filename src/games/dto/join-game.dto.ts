import { IsString, IsNotEmpty, Length } from 'class-validator';

export class JoinGameDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 15)
  playerName!: string;
} 