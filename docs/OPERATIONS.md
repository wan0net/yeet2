# yeet2 Operations

## Purpose

This document is the operator-oriented runtime guide for yeet2.

## Main Runtime Modes

### Local development

Use this when developing inside the repo.

- infrastructure: local Docker Compose
- app services: direct local processes

### Hosted dogfood

Use this on `10.42.10.101`.

- `docker-compose.deploy.yml`
- builds images on-host
- current internal dogfood path

### Release deployment

Use this when pulling prebuilt images from GHCR.

- `docker-compose.release.yml`
- does not require image builds on-host

## Required Runtime Inputs

Core environment values:

- `DATABASE_URL`
- `REDIS_URL`
- `YEET2_BRAIN_BASE_URL`
- `YEET2_EXECUTOR_BASE_URL`

Planning/runtime credentials:

- `OPENROUTER_API_KEY` or `OPENAI_API_KEY`
- `YEET2_BRAIN_CREWAI_ENABLED`
- `YEET2_BRAIN_CREWAI_MODEL`

Execution/runtime credentials:

- `LLM_API_KEY`
- `LLM_MODEL`
- `LLM_BASE_URL`
- `YEET2_EXECUTOR_MODE`

GitHub integration:

- `GITHUB_TOKEN`

## Service Health

Typical health checks:

- Control: `GET /`
- API: `GET /health`
- Brain: `GET /health`
- Executor: `GET /health`

## Operating Sequence

The usual operator flow is:

1. bring the stack up
2. verify service health
3. register or inspect projects
4. start or supervise autonomy
5. watch approvals, blockers, jobs, and project chat

## Core Operator Surfaces

### Dashboard

Use Dashboard to answer:

- what needs attention now
- are approvals waiting
- are blockers piling up
- are workers available

### Projects

Use Projects to answer:

- which project should I open next
- which project has blockers or active work

### Project Detail

Use Project Detail to answer:

- what is the next action
- is autonomy running
- what mission is active
- what are the current task lanes
- what are agents saying in the team chat

### Approvals

Use Approvals for human-gated decisions that are blocking progress.

### Blockers

Use Blockers for open clarification or failure states that need attention.

### Jobs / Tasks / Missions

Use these pages as queue views for system-wide triage.

## Chat Operations

Project chat is both:

- a working log
- a handoff lane

Operator guidance rules:

- targeted messages should use `@role` or `@staff-member`
- replies inherit target context when no new mention is included
- broadcast comments are visible but not automatically actionable

## Deployment Commands

### Build-on-host path

```bash
docker compose --env-file .env -f docker-compose.deploy.yml up -d --build
```

### GHCR release path

```bash
docker login ghcr.io
docker compose --env-file .env -f docker-compose.release.yml pull
docker compose --env-file .env -f docker-compose.release.yml up -d
```

## Recovery Notes

If the system is not progressing:

1. check health endpoints
2. inspect the project page for blockers or waiting approvals
3. inspect the Jobs queue for failed or stuck runs
4. inspect project chat and decision logs for the latest handoff or failure context
5. verify Brain and Executor credentials are still valid

## Security And Safety

Current safety posture:

- no destructive git operations in normal task execution
- isolated worktree/branch policy
- job logs persisted
- blocker escalation after repeated failure
- optional ASRT-backed sandbox path for executor evolution

Still evolving:

- stronger sandbox defaults
- deeper auth
- richer audit and replay surfaces
