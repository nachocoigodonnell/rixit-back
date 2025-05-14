import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Player } from '../../players/entities/player.entity';
import { Round } from '../../rounds/entities/round.entity';

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  code!: string;

  @Column({ default: 'lobby' })
  stage!: string;

  @OneToMany(() => Player, (player) => player.game, { cascade: true })
  players!: Player[];

  @OneToMany(() => Round, (round) => round.game, { cascade: true })
  rounds!: Round[];
} 