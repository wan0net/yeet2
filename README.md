# yeet2

yeet2 is a self-hosted autonomous software-team platform. It keeps project intent in durable constitutions, turns that intent into missions and tasks, and routes work through specialist agents and execution workers over time.

The internal dogfood project is `forgeyard`, which is the in-use expression of yeet2 rather than a separate adjacent track.

## Layout

This repo is intended to grow into a monorepo with these major areas:

- `apps/control` for the web UI
- `apps/api` for the Fastify API
- `apps/brain` for CrewAI orchestration
- `apps/executor` for OpenHands-backed execution
- `packages/db` for PostgreSQL schema ownership
- `packages/constitution` for constitution discovery and parsing
- `packages/domain` and `packages/ui` for shared types and UI primitives
- `infra/docker` and `infra/nomad` for local and future execution infrastructure
- `docs` for product and implementation decisions

## Documentation Map

Core docs:

- [docs/VISION.md](/Users/icd/Workspace/nas/yeet2/docs/VISION.md)
- [docs/SPEC.md](/Users/icd/Workspace/nas/yeet2/docs/SPEC.md)
- [docs/ROADMAP.md](/Users/icd/Workspace/nas/yeet2/docs/ROADMAP.md)
- [docs/PRODUCT_SPEC.md](/Users/icd/Workspace/nas/yeet2/docs/PRODUCT_SPEC.md)

System reference docs:

- [docs/ARCHITECTURE.md](/Users/icd/Workspace/nas/yeet2/docs/ARCHITECTURE.md)
- [docs/DATA_FLOWS.md](/Users/icd/Workspace/nas/yeet2/docs/DATA_FLOWS.md)
- [docs/OPERATIONS.md](/Users/icd/Workspace/nas/yeet2/docs/OPERATIONS.md)
- [docs/DEVELOPMENT.md](/Users/icd/Workspace/nas/yeet2/docs/DEVELOPMENT.md)
- [docs/CI_CD.md](/Users/icd/Workspace/nas/yeet2/docs/CI_CD.md)
- [docs/DECISIONS.md](/Users/icd/Workspace/nas/yeet2/docs/DECISIONS.md)

## Local Development

1. Copy `.env.example` to `.env` and fill in local values.
2. Start PostgreSQL and Redis with `docker compose up -d`.
3. In separate terminals, start Control, API, and Brain with:
   - `pnpm dev:control`
   - `pnpm dev:api`
   - `pnpm dev:brain`
4. If you also want the Executor skeleton, run `pnpm dev:executor` in another terminal.

Brain binds from repo-level env first, so `YEET2_HOST` and `BRAIN_PORT` from `.env` control the local listener. The compose file stays infra-only for now, which keeps the app runtime explicit and easy to change per service.

The API now calls Brain directly and surfaces planning failures instead of silently synthesizing a fallback plan. Set `YEET2_BRAIN_PLANNER_BACKEND=deterministic` only if you want the local rule-based planner; otherwise Brain/CrewAI failures are returned as errors.

## Operator Deployment: 10.42.10.101

This is the on-host bring-up path for the forgeyard dogfood stack.

1. Copy `.env.example` to `.env` on `10.42.10.101` and fill in the operational values:
   - `GITHUB_TOKEN` for GitHub-backed project registration, blockers, pull requests, and merge refresh.
   - `LLM_API_KEY`, `LLM_MODEL`, and `LLM_BASE_URL` for OpenHands execution.
   - `OPENROUTER_API_KEY` or `OPENAI_API_KEY` for CrewAI planning, depending on the model/provider path you use.
   - `YEET2_BRAIN_CREWAI_ENABLED=true` and `YEET2_BRAIN_CREWAI_MODEL=<model>` if Brain should plan with CrewAI on the host.
   - `YEET2_EXECUTOR_MODE`, `YEET2_EXECUTOR_SANDBOX_MODE`, and related executor/OpenHands settings for the runtime you want on the box.
2. Bring the full stack up from the repo root:
   - `docker compose --env-file .env -f docker-compose.deploy.yml up -d --build`
3. Verify the stack:
   - `curl http://10.42.10.101:3001/health`
   - `curl http://10.42.10.101:3002/health`
   - `curl http://10.42.10.101:3003/health`
   - load `http://10.42.10.101:3000/projects` in a browser
4. Watch startup and migrations when needed:
   - `docker compose --env-file .env -f docker-compose.deploy.yml logs -f migrate api brain executor control`
5. Register the first forgeyard project in Control:
   - open the Projects page
   - create a project named `forgeyard`
   - prefer `repoUrl` so yeet2 clones into the shared managed-projects volume inside the deployed stack
   - only use `localPath` if you intentionally extend the compose setup with a host bind mount that makes that checkout visible to both API and Executor
   - confirm the new project appears in the attached projects list

The root `docker-compose.yml` remains the lightweight local infra file. The real single-host deployment path now lives in `docker-compose.deploy.yml`.

## CI/CD And GHCR

yeet2 now ships with GitHub Actions for validation, security scanning, and GHCR image publishing.

- `CI` runs workspace typechecks, builds, Prisma client generation, and Python compile checks.
- `Security` runs Semgrep and Trivy.
- `Publish Images` builds and pushes:
  - `ghcr.io/<owner>/yeet2-node`
  - `ghcr.io/<owner>/yeet2-brain`
  - `ghcr.io/<owner>/yeet2-executor`

For a release-style deployment that pulls prebuilt images instead of building on-host, use:

- [docker-compose.release.yml](/Users/icd/Workspace/nas/yeet2/docker-compose.release.yml)
- [docs/CI_CD.md](/Users/icd/Workspace/nas/yeet2/docs/CI_CD.md)
