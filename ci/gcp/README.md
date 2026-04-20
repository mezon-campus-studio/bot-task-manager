# Sample Campus GCP Bootstrap

This directory keeps the GCP bootstrap and operational scripts for the `sample-campus` Cloud Run stack.

## Files

- `init_gcp.sh`
  Creates the project baseline for one environment: APIs, Artifact Registry, Cloud SQL, service accounts, GitHub OIDC/WIF, and Secret Manager entries.
- `sync_secrets.sh`
  Upserts runtime secrets into Secret Manager and syncs the Cloud SQL app password with `DB_PASSWORD`.
- `setup_monitoring.sh`
  Creates the `/health` uptime check plus three alert policies: service down, migration job failure, and HTTP 5xx traffic.
- `templates/secrets.dev.env.template`
  Copy target for dev secret values.
- `templates/secrets.prod.env.template`
  Copy target for prod secret values.

## Bootstrap Order

1. Run `init_gcp.sh` once per project.
2. Copy one template to a local `.env` file outside Git, fill the real values, then run `sync_secrets.sh`.
3. Add the GitHub environment variables listed below.
4. Trigger `.github/workflows/sample-campus-deploy.yml`.
5. After the first successful deploy, run `setup_monitoring.sh`.

Branch mapping:

- push to `develop` deploys to GitHub environment `dev`
- push to `main` deploys to GitHub environment `prod`
- `workflow_dispatch` can still be used for manual deploys to either environment

## GitHub Environment Variables

Configure these per GitHub environment (`dev`, `prod`):

- `GCP_PROJECT_ID`
- `GCP_PROJECT_NUMBER`
- `GCP_REGION`
- `GCP_WIF_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`
- `GAR_REPOSITORY`
- `CLOUD_RUN_SERVICE`
- `CLOUD_RUN_JOB`
- `FRONTEND_URL`
- `OAUTH_URL`

`init_gcp.sh` prints the first eight values after bootstrap. `FRONTEND_URL` and `OAUTH_URL` stay manual because they are application-specific.

## Example Commands

```bash
ORGANIZATION_ID=123456789012 \
BILLING_ACCOUNT=000000-000000-000000 \
GITHUB_REPOSITORY=my-org/sample-campus \
./ci/gcp/init_gcp.sh dev my-sample-campus-dev
```

```bash
cp ci/gcp/templates/secrets.dev.env.template /tmp/sample-campus-dev.env
$EDITOR /tmp/sample-campus-dev.env
./ci/gcp/sync_secrets.sh dev my-sample-campus-dev /tmp/sample-campus-dev.env
```

```bash
./ci/gcp/setup_monitoring.sh dev my-sample-campus-dev
```
