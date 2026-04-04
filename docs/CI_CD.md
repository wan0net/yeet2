# CI/CD

yeet2 now has a GitHub Actions pipeline for validation, security scanning, and container publishing.

## Workflows

- `ci.yml`
  - installs the pnpm workspace
  - generates the Prisma client
  - runs workspace typechecks
  - runs workspace builds
  - compiles the Brain and Executor Python services

- `security.yml`
  - runs `semgrep scan --config auto --error`
  - runs Trivy as a filesystem scan against the repo

- `publish-images.yml`
  - builds and pushes multi-arch images to GHCR
  - publishes:
    - `ghcr.io/<owner>/yeet2-node`
    - `ghcr.io/<owner>/yeet2-brain`
    - `ghcr.io/<owner>/yeet2-executor`
  - scans each pushed image with Trivy

## GHCR Images

Published image roles:

- `yeet2-node`
  - used by Control
  - used by API
  - used by the one-shot migration service

- `yeet2-brain`
  - Python Brain runtime with CrewAI path available

- `yeet2-executor`
  - Python Executor runtime with the OpenHands launch path

## Release Deployment

Use [docker-compose.release.yml](/Users/icd/Workspace/nas/yeet2/docker-compose.release.yml) when deploying prebuilt GHCR images instead of building on-host.

Example:

```bash
docker login ghcr.io
docker compose --env-file .env -f docker-compose.release.yml pull
docker compose --env-file .env -f docker-compose.release.yml up -d
```

Image overrides are available through env vars:

- `YEET2_NODE_IMAGE`
- `YEET2_BRAIN_IMAGE`
- `YEET2_EXECUTOR_IMAGE`
- `YEET2_CONTROL_ORIGIN`

## Recommended Secrets

For runtime deployment:

- `GITHUB_TOKEN`
- `OPENROUTER_API_KEY` or `OPENAI_API_KEY`
- `LLM_API_KEY`
- any model/runtime env vars already described in `.env.example`

For GitHub Actions:

- no extra package-publish token is required for the default GHCR path because the workflow uses the built-in `GITHUB_TOKEN`

## Operator Notes

- Keep `docker-compose.deploy.yml` for the existing host-build path.
- Use `docker-compose.release.yml` for the GHCR-backed release path.
- If Trivy or Semgrep start failing on new dependency patterns, fix the issue rather than blanket-disabling the scan unless the exception is documented in `docs/DECISIONS.md`.
