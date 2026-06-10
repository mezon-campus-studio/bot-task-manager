import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeCurrentProjectId1777440000000 implements MigrationInterface {
  name = 'NormalizeCurrentProjectId1777440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_users_current_project_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "current_project_id" TYPE integer
      USING CASE
        WHEN "current_project_id" ~ '^\\d+$' THEN "current_project_id"::integer
        ELSE NULL
      END
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_users_current_project_id" ON "users" ("current_project_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_users_current_project_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "current_project_id" TYPE character varying
      USING "current_project_id"::character varying
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_users_current_project_id" ON "users" ("current_project_id")`,
    );
  }
}
