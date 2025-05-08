import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from './entities/player.entity';

@Injectable()
export class PlayersService {
  constructor(@InjectRepository(Player) private readonly repo: Repository<Player>) {}

  create(data: Partial<Player>) {
    const player = this.repo.create(data);
    return this.repo.save(player);
  }

  findAll() {
    return this.repo.find({ relations: ['game'] });
  }

  findOne(id: string) {
    return this.repo.findOne({ where: { id }, relations: ['game'] });
  }

  update(id: string, data: Partial<Player>) {
    return this.repo.update(id, data);
  }

  remove(id: string) {
    return this.repo.delete(id);
  }
} 