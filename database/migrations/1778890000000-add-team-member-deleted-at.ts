import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeamMemberDeletedAt1778890000000 implements MigrationInterface {
  name = 'AddTeamMemberDeletedAt1778890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasDeletedAt = await queryRunner.hasColumn(
      'team_members',
      'deleted_at',
    );

    if (!hasDeletedAt) {
      await queryRunner.query(
        `ALTER TABLE "team_members" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasDeletedAt = await queryRunner.hasColumn(
      'team_members',
      'deleted_at',
    );

    if (hasDeletedAt) {
      await queryRunner.query(
        `ALTER TABLE "team_members" DROP COLUMN "deleted_at"`,
      );
    }
  }
}
