import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminRoleToUserEnum1777441111111 implements MigrationInterface {
  name = 'AddAdminRoleToUserEnum1777441111111';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add '4' value to users_role_enum
    await queryRunner.query(
      `ALTER TYPE "users_role_enum" ADD VALUE '4' BEFORE '1'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // TypeORM doesn't support removing enum values, so we can't rollback
    // In production, you would need to manually handle this
  }
}
