import { Column, Entity, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Game } from '../../games/entities/game.entity';
import { Player } from '../../players/entities/player.entity';

@Entity('rounds')
export class Round {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Game, (game) => game.rounds, { onDelete: 'CASCADE' })
  game!: Game;

  @Column()
  number!: number;

  @ManyToOne(() => Player, { nullable: true })
  narrator?: Player;

  @Column({ nullable: true })
  clue?: string;

  @Column({ default: 'pending' })
  status!: string; // pending | submitting | voting | revealed
} 