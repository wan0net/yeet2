# yeet2

yeet2 is a self-hosted autonomous software-team platform. It keeps project intent in durable constitutions, turns that intent into missions and tasks, and routes work through specialist agents and execution workers over time.

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
3. Bring up the app services from their package-level tooling once those workspaces are added.

This bootstrap only sets up the shared infrastructure slice. The application services and workspace tooling will come in later milestones.

