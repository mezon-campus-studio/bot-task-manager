import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateNoteTable1778607247114 implements MigrationInterface {
  name = 'UpdateNoteTable1778607247114';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('notes');

    if (!table?.findColumnByName('is_pinned')) {
      await queryRunner.query(
        `ALTER TABLE "notes" ADD "is_pinned" boolean NOT NULL DEFAULT false`,
      );
    }

    if (!table?.findColumnByName('is_shared')) {
      await queryRunner.query(
        `ALTER TABLE "notes" ADD "is_shared" boolean NOT NULL DEFAULT true`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notes" DROP COLUMN "is_shared"`);
    await queryRunner.query(`ALTER TABLE "notes" DROP COLUMN "is_pinned"`);
  }
}
