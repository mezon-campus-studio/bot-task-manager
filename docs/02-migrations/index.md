Database Migration Workflow (TypeORM)

## Goal

Treat database schema changes as a first-class part of **Vertical Slice Delivery**. Never make manual database changes — everything must be version-controlled through proper migrations.

## Core Principles

### 1. Migration Structure (TypeORM)

Every migration is a TypeScript class with two methods:

- `up()`: Contains the SQL commands to apply changes (`CREATE TABLE`, `ALTER COLUMN`, `ADD COLUMN`, etc.).
- `down()`: Contains the SQL commands to revert the changes (`DROP TABLE`, `ALTER COLUMN`, etc.).

TypeORM tracks applied migrations in a `migrations` table in the database and only runs new ones.

### 2. Standard Migration Workflow

**Step 1: Update the Entity**
Modify, add, or remove properties in the relevant `*.entity.ts` file(s).

**Step 2: Auto-generate the Migration**
Let TypeORM compare the current entities with the actual database schema and generate the migration file:

```bash
yarn migration:generate database/migrations/YourMigrationName
```

> **Important:** Always review the generated file in `database/migrations/` before committing. The auto-generator can sometimes produce unwanted `DROP` operations if entities are not correctly registered.

**Step 3: Apply the Migration**
Run the migration against your local database:

```bash
yarn migrate
```

**Step 4: Rollback (If Needed)**
If you need to revert the last migration:

```bash
yarn migrate:rollback
```

### 3. Essential Migration Commands

- `yarn migrate:fresh` — Drops all tables and re-runs all migrations from scratch (useful for local reset).
- `yarn migration:create database/migrations/YourMigrationName` — Creates an empty migration file for manual SQL (use for complex triggers, views, indexes, or data seeding).
- `yarn migrate:prod` — Command used in CI/CD to apply migrations during production deployment.

### 4. Mandatory Rules

1. **Never edit a migration that has already been merged**  
   Once a migration file has been pushed/merged to the main branch and run on staging or production, it must never be modified. Create a new migration instead.

2. **Always review generated SQL**  
   Auto-generation is convenient but can produce dangerous commands (e.g., `DROP COLUMN`, `DROP TABLE`). Carefully read both `up()` and `down()` before committing.

## Success Signal

Database schema changes are always delivered together with the corresponding entity, service, controller, and tests in a single vertical slice. The migration history is clean, reversible, and safe to run on any environment. No one ever runs manual SQL directly against the database.
