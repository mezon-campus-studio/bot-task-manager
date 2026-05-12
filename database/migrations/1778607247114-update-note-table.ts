import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateNoteTable1778607247114 implements MigrationInterface {
    name = 'UpdateNoteTable1778607247114'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "team_members" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "teams" ADD "leader_id" uuid`);
        await queryRunner.query(`CREATE TYPE "public"."teams_status_enum" AS ENUM('active', 'inactive')`);
        await queryRunner.query(`ALTER TABLE "teams" ADD "status" "public"."teams_status_enum" NOT NULL DEFAULT 'active'`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('0', '1', '2', '3')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "role" "public"."users_role_enum" DEFAULT '3'`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'inactive', 'deleted')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "status" "public"."users_status_enum" DEFAULT 'active'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "last_active_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD "deleted_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "notes" ADD "is_pinned" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "notes" ADD "is_shared" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`CREATE INDEX "IDX_teams_leader_id" ON "teams" ("leader_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_teams_leader_id"`);
        await queryRunner.query(`ALTER TABLE "notes" DROP COLUMN "is_shared"`);
        await queryRunner.query(`ALTER TABLE "notes" DROP COLUMN "is_pinned"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_active_at"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."teams_status_enum"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "leader_id"`);
        await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN "deleted_at"`);
    }

}
