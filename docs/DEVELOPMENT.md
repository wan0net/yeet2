# yeet2 Development

## Purpose

This document explains how to work on yeet2 as a developer.

## Local Setup

1. copy `.env.example` to `.env`
2. start infra with `docker compose up -d`
3. run the services you need:
   - `pnpm dev:control`
   - `pnpm dev:api`
   - `pnpm dev:brain`
   - `pnpm dev:executor`

## Core Development Commands

```bash
pnpm install
pnpm typecheck
pnpm build
```

Useful targeted commands:

```bash
pnpm --filter @yeet2/control typecheck
pnpm --filter @yeet2/control build
pnpm --filter @yeet2/api typecheck
pnpm --filter @yeet2/db exec prisma generate
```

Python-side sanity:

```bash
python3 -m compileall apps/brain/src/yeet2_brain
python3 -m compileall apps/executor/src/yeet2_executor
```

## How To Think About The Repo

### If you are changing the UI

You are usually working in:

- `apps/control/src/routes`
- `apps/control/src/lib`
- `apps/control/src/app.css`

### If you are changing control-plane behavior

You are usually working in:

- `apps/api/src/projects.ts`
- `apps/api/src/routes/projects.ts`
- `apps/api/src/autonomy-loop.ts`
- `apps/api/src/decision-logs.ts`

### If you are changing planning

You are usually working in:

- `apps/api/src/planning.ts`
- `apps/brain/src/yeet2_brain/planner.py`
- `apps/brain/src/yeet2_brain/roles.py`

### If you are changing execution

You are usually working in:

- `apps/executor/src/yeet2_executor/adapters.py`
- `apps/executor/src/yeet2_executor/http.py`
- `apps/api/src/projects.ts`

## Project Constitution

yeet2 is driven by durable docs.

Every managed project should expose:

- `docs/VISION.md`
- `docs/SPEC.md`
- `docs/ROADMAP.md`

Recommended:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/QUALITY_BAR.md`

## Development Principles

- prefer explicit durable state over hidden runtime assumptions
- keep Control API-first
- keep Brain failures visible rather than silently hiding them
- keep Executor behind an adapter boundary
- preserve non-destructive git policy
- prefer changing backend behavior in a way the future UI rebuild can keep using

## CI/CD

GitHub Actions now cover:

- CI validation
- Semgrep
- Trivy
- GHCR publishing

Use [CI_CD.md](./CI_CD.md) for the release/deploy side.

## Documentation Set

The current core docs are:

- [VISION.md](./VISION.md)
- [SPEC.md](./SPEC.md)
- [ROADMAP.md](./ROADMAP.md)
- [PRODUCT_SPEC.md](./PRODUCT_SPEC.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DATA_FLOWS.md](./DATA_FLOWS.md)
- [OPERATIONS.md](./OPERATIONS.md)
- [CI_CD.md](./CI_CD.md)
- [DECISIONS.md](./DECISIONS.md)
