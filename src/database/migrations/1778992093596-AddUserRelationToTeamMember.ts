import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRelationToTeamMember1778992093596 implements MigrationInterface {
  name = 'AddUserRelationToTeamMember1778992093596';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "team_members" ADD CONSTRAINT "FK_c2bf4967c8c2a6b845dadfbf3d4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "team_members" DROP CONSTRAINT "FK_c2bf4967c8c2a6b845dadfbf3d4"`,
    );
  }
}
