import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateTokenBlacklistTable1778950000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'token_blacklist',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'jti',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create unique index on jti
    await queryRunner.createIndex(
      'token_blacklist',
      new TableIndex({
        name: 'IDX_token_blacklist_jti',
        columnNames: ['jti'],
        isUnique: true,
      }),
    );

    // Create index on expires_at for cleanup queries
    await queryRunner.createIndex(
      'token_blacklist',
      new TableIndex({
        name: 'IDX_token_blacklist_expires_at',
        columnNames: ['expires_at'],
      }),
    );

    // Create index on user_id for user-specific queries
    await queryRunner.createIndex(
      'token_blacklist',
      new TableIndex({
        name: 'IDX_token_blacklist_user_id',
        columnNames: ['user_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('token_blacklist', true);
  }
}
