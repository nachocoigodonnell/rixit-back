import { Column, Entity, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Game } from '../../games/entities/game.entity';

@Entity('players')
export class Player {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ default: 0 })
  score!: number;

  @Column({ default: false })
  isHost!: boolean;

  @Column('jsonb', { default: [] })
  hand!: any[];

  @ManyToOne(() => Game, (game) => game.players, { onDelete: 'CASCADE' })
  game!: Game;
} 