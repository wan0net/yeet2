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

## Local Development

1. Copy `.env.example` to `.env` and fill in local values.
2. Start PostgreSQL and Redis with `docker compose up -d`.
3. In separate terminals, start Control, API, and Brain with:
   - `pnpm dev:control`
   - `pnpm dev:api`
   - `pnpm dev:brain`
4. If you also want the Executor skeleton, run `pnpm dev:executor` in another terminal.

Brain binds from repo-level env first, so `YEET2_HOST` and `BRAIN_PORT` from `.env` control the local listener. The compose file stays infra-only for now, which keeps the app runtime explicit and easy to change per service.
