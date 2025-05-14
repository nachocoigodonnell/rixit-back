import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1747228964913 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Crear tabla de juegos
        await queryRunner.query(`
            CREATE TABLE "games" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "code" varchar NOT NULL UNIQUE,
                "stage" varchar NOT NULL DEFAULT 'lobby'
            )
        `);

        // Crear tabla de jugadores
        await queryRunner.query(`
            CREATE TABLE "players" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "name" varchar NOT NULL,
                "score" integer NOT NULL DEFAULT 0,
                "isHost" boolean NOT NULL DEFAULT false,
                "hand" jsonb NOT NULL DEFAULT '[]',
                "gameId" uuid,
                CONSTRAINT "fk_game" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
            )
        `);

        // Crear tabla de rondas
        await queryRunner.query(`
            CREATE TABLE "rounds" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "number" integer NOT NULL,
                "status" varchar NOT NULL DEFAULT 'pending',
                "data" jsonb NOT NULL DEFAULT '{}',
                "gameId" uuid,
                CONSTRAINT "fk_game_round" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "rounds"`);
        await queryRunner.query(`DROP TABLE "players"`);
        await queryRunner.query(`DROP TABLE "games"`);
    }

}
