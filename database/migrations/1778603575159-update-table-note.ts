import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTableNote1778603575159 implements MigrationInterface {
    name = 'UpdateTableNote1778603575159'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notes" ADD "is_pinned" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "notes" ADD "is_shared" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notes" DROP COLUMN "is_shared"`);
        await queryRunner.query(`ALTER TABLE "notes" DROP COLUMN "is_pinned"`);
    }

}
