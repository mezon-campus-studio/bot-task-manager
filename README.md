# Mezon Campus

## Migration Convention

`sample-campus` follows the same migration convention:

- Schema-only change:
  use `migration:generate` so TypeORM diffs entity metadata against the database schema.
- Data migration / enum migration / backfill:
  use `migration:create`, then write the migration by hand and use helpers from `#src/utils/migration` or `#src/utils`.

### Commands

Create an empty migration:

```bash
yarn migration:create ./database/migrations/create-users-profile
```

Generate a schema diff migration:

```bash
yarn migration:generate ./database/migrations/update-users-profile
```

Run migrations:

```bash
yarn migrate
```

Rollback last migration:

```bash
yarn migrate:rollback
```

Reset and rerun all migrations:

```bash
yarn migrate:fresh
```

## Local Docker

For a local stack with preconfigured infra, use the compose file inside `sample-campus`:

```bash
cd sample-campus
docker compose up -d --build --remove-orphans
```

This starts every service declared in [sample-campus/docker-compose.yml](/Users/macbookpro/onramp-backend/sample-campus/docker-compose.yml):

- `sample-campus-postgres` on `localhost:5433`
- `sample-campus` on `localhost:4000`

The app container loads [sample-campus/.env](/Users/macbookpro/onramp-backend/sample-campus/.env) and then overrides the database connection to use the internal Compose host `sample-campus-postgres`.

The `sample-campus` app container will:

- wait for Postgres
- run `yarn migrate`
- start the Nest app

For local Docker only, `NEZON_DISABLE_BOOTSTRAP=true` is injected by compose so the app does not try to log in to the real Mezon service with a local placeholder token.

### Manual Migration Helpers

For manual migrations, import helpers the same way as `onramp-api`:

```ts
import { insertInMigration, updateInMigration } from '#src/utils/migration';
```

or:

```ts
import { insertInMigration, bulkUpdateInMigration } from '#src/utils';
```

Use this style for:

- seed-like inserts
- enum value changes
- bulk backfills
- data cleanup / patch migrations

## Git Workflow

To avoid conflicts and make mentor reviews faster, follow the Git workflow below:

### 1. Create a branch from the ticket

Before starting any work, always checkout from `develop` and create a new branch that matches the ticket you are working on.

Branch format:

```bash
MEZON-[number]
```

Example:

```bash
git checkout develop
git pull origin develop
git checkout -b MEZON-123
```

Do not work directly on `develop`.

### 2. Work on your ticket branch

After creating the correct branch, complete the task on that branch only.

During implementation:

- write clear and easy-to-understand commit messages
- review your logic, formatting, and related affected areas before pushing
- if the branch is outdated, pull the latest `develop` and resolve conflicts before pushing

### 3. Push the branch to remote

Once the task is complete, push your branch to remote:

```bash
git push origin MEZON-123
```

### 4. Create a Pull Request to `develop`

After pushing, create a PR with:

- base branch: `develop`
- compare branch: your ticket branch

The PR title must clearly include the ticket:

```text
[MEZON-number] feature/fix: short and clear description of the task
```

Example:

```text
[MEZON-123] feature: add student profile API
```

### 5. Write a clear PR description

The PR description should be clear, complete, and easy to review:

- what ticket you worked on
- what you completed
- whether there are changes to logic, API, database, or migrations
- any notes the reviewer should pay attention to

You can use this template:

```md
## Ticket
MEZON-123

## Summary
- Brief summary of the completed work

## Changes
- Add API ...
- Update service ...
- Update migration ... (if any)

## Notes
- Points the reviewer should pay attention to
```

### 6. Send the PR to your mentor for review

After creating the PR, send it to your mentor for review.

Only merge after:

- the PR has been reviewed
- important comments have been addressed
- the branch is ready to merge into `develop`
