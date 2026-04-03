# Docker Infrastructure

This directory contains the container packaging used by the single-host deployment path.

Current files:

- `Dockerfile.node` builds the workspace image used by Control, API, and the one-shot Prisma migration service.
- `Dockerfile.brain` packages the Python Brain service with the optional CrewAI path available.
- `Dockerfile.executor` packages the Executor service and its `uv`-based OpenHands launch path.
- `run-migrate.sh` runs Prisma generate + `db push` inside the deploy stack.
- `start-executor.sh` starts the Executor HTTP server on the configured container port.

Primary deploy command on `10.42.10.101`:

- `docker compose --env-file .env -f docker-compose.deploy.yml up -d --build`

Notes:

- The deploy compose file is intentionally separate from the root `docker-compose.yml`, which remains the lightweight local infra file.
- The deployed stack assumes repo registration by `repoUrl` so API and Executor can share the managed-projects volume cleanly.
- If you want to attach host checkouts by `localPath`, add an explicit host bind mount that is visible to both API and Executor at the same in-container path.
- Keep secrets in `.env` on the host; do not hardcode them into compose files.
