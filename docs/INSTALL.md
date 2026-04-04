# yeet2 Installation Guide

## Prerequisites

- Docker Engine and Docker Compose v2 (`docker compose` not `docker-compose`)
- Git
- A host IP or domain that the Control UI will be served from (needed for CSRF origin)
- **Optional:** GitHub personal access token for PR automation (`GITHUB_TOKEN`)
- **Optional:** OpenRouter or OpenAI API key if you want CrewAI planning (`OPENROUTER_API_KEY` / `OPENAI_API_KEY`). A deterministic fallback planner is available with no key required.
- **Required for execution:** An LLM API key for OpenHands (`LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`)

---

## Quick Start — Release Path (GHCR images)

Use this path when you want to pull pre-built images rather than building from source.

**1. Clone the repo**

```bash
git clone https://github.com/wan0net/yeet2.git
cd yeet2
```

**2. Create your `.env`**

```bash
cp .env.example .env
```

**3. Configure required variables**

Open `.env` and set at minimum:

```dotenv
# Set to the IP/hostname and port where you will access the UI
YEET2_CONTROL_ORIGIN=http://10.42.10.101:3000

# LLM credentials for the executor (OpenHands uses these)
LLM_API_KEY=sk-...
LLM_MODEL=anthropic/claude-sonnet-4-5
LLM_BASE_URL=https://openrouter.ai/api/v1
```

Everything else has workable defaults. See [Configuration Reference](#configuration-reference) below.

**4. Pull and start**

```bash
docker compose --env-file .env -f docker-compose.release.yml pull
docker compose --env-file .env -f docker-compose.release.yml up -d
```

**5. Verify**

```bash
curl http://localhost:3001/health
# → {"status":"ok"}
```

**6. Open the Control UI**

Navigate to `http://localhost:3000` (or your configured host).

---

## Build-on-Host Path

Use this path to build images directly from source — the current dogfood path on `10.42.10.101`.

Steps 1–3 are identical to the release path. Then:

```bash
docker compose --env-file .env -f docker-compose.deploy.yml up -d --build
```

To rebuild after a `git pull`:

```bash
git pull
docker compose --env-file .env -f docker-compose.deploy.yml up -d --build
```

---

## Configuration Reference

All variables live in `.env`. The full list with defaults is in `.env.example`. Key variables:

### Core

| Variable | Default | Description |
|---|---|---|
| `CONTROL_PORT` | `3000` | Host port for the SvelteKit UI |
| `API_PORT` | `3001` | Host port for the Fastify API |
| `BRAIN_PORT` | `3002` | Host port for the Brain service |
| `EXECUTOR_PORT` | `3003` | Host port mapping to executor's internal 8021 |
| `YEET2_CONTROL_ORIGIN` | `http://localhost:3000` | **Must match the URL you use to access the UI.** SvelteKit uses this for CSRF checks — form submissions will be rejected if it's wrong. |
| `YEET2_PROJECTS_DIR` | `/tmp/yeet2-projects` | Where cloned project repos live inside the container. Use a persistent path in production. |

### Autonomy

| Variable | Default | Description |
|---|---|---|
| `YEET2_AUTONOMY_LOOP_ENABLED` | `true` | Enables the background autonomy loop |
| `YEET2_AUTONOMY_LOOP_INTERVAL_MS` | `60000` | How often the autonomy loop ticks (ms) |

### Planning (Brain)

| Variable | Default | Description |
|---|---|---|
| `YEET2_BRAIN_PLANNER_BACKEND` | `auto` | `auto` uses CrewAI if enabled, otherwise deterministic. `deterministic` forces the rule-based planner. |
| `YEET2_BRAIN_CREWAI_ENABLED` | `false` | Set `true` to enable CrewAI-backed planning |
| `YEET2_BRAIN_CREWAI_MODEL` | _(blank)_ | Model string passed to CrewAI (e.g. `openrouter/anthropic/claude-sonnet-4-5`) |
| `OPENROUTER_API_KEY` | _(blank)_ | OpenRouter key for Brain's CrewAI planner |
| `OPENAI_API_KEY` | _(blank)_ | OpenAI key alternative for Brain's CrewAI planner |
| `YEET2_BRAIN_PLAN_TIMEOUT_MS` | `45000` | Timeout for a single planning call |

### Execution (Executor / OpenHands)

| Variable | Default | Description |
|---|---|---|
| `YEET2_EXECUTOR_MODE` | `openhands` | Execution adapter. `openhands` is the only production-ready option. |
| `LLM_API_KEY` | _(blank)_ | API key passed to OpenHands for task execution |
| `LLM_MODEL` | _(blank)_ | Model identifier passed to OpenHands |
| `LLM_BASE_URL` | _(blank)_ | Base URL for the LLM API (e.g. OpenRouter) |
| `YEET2_OPENHANDS_TIMEOUT_SECONDS` | `1800` | Per-job timeout. Blank = no timeout (dangerous in production). |
| `YEET2_EXECUTOR_WORKTREE_CLEANUP` | `on_success` | When to clean up git worktrees: `on_success`, `always`, or `never` |

### GitHub

| Variable | Default | Description |
|---|---|---|
| `GITHUB_TOKEN` | _(blank)_ | Personal access token with `repo` scope. Required for PR creation and branch push. |

---

## Register Your First Project

1. Open the Control UI and navigate to **Projects → Add project**
2. Enter a project name, the repo URL (e.g. `https://github.com/org/repo`) or a local path, and the default branch
3. Submit — the API will clone the repo and scan for constitution files
4. Open the project detail page. The "Constitution" section shows pills for detected files (`VISION.md`, `SPEC.md`, `ROADMAP.md`, etc.)
5. Once constitution files are detected the project is ready for planning

Constitution files are read from the `docs/` directory of the registered repo. A project without any constitution files can still be planned against, but quality will be lower.

---

## Forgeyard Self-Dogfood Setup

To register yeet2 itself as the `forgeyard` project on `10.42.10.101`:

**1. Set a persistent projects directory in `.env`**

```dotenv
YEET2_PROJECTS_DIR=/var/lib/yeet2/projects
```

This path is mounted as a named volume in the compose files, so it survives restarts.

**2. Register via the UI**

- Name: `forgeyard`
- Repo URL: `https://github.com/wan0net/yeet2`
- Default branch: `main`

**3. Confirm constitution detection**

The project detail page should show pills for `VISION.md`, `SPEC.md`, `ROADMAP.md`, `ARCHITECTURE.md`, and others from `docs/`.

**4. Set autonomy mode to `supervised`**

On the project detail page, set autonomy to **Supervised** before the first planning run. This lets you review proposed task dispatches before they execute.

---

## Verify the System

Check individual service health:

```bash
curl http://localhost:3001/health   # API
curl http://localhost:3002/health   # Brain
curl http://localhost:3003/health   # Executor
```

In the Control UI:

- **Overview / Dashboard** — shows active projects, pending approvals, and blockers
- **Workers** — confirms the executor has registered and is sending heartbeats
- **Project detail → Constitution** — confirms constitution files were detected

---

## Local Development

For working on yeet2 itself — services run as local processes, only infra runs in Docker.

**1. Start infrastructure**

```bash
docker compose up -d
# starts postgres (5432) and redis (6379) only
```

**2. Configure environment**

```bash
cp .env.example .env
# Leave DATABASE_URL and REDIS_URL pointing at localhost — the defaults work
```

**3. Install Node dependencies**

```bash
pnpm install
```

**4. Run database migrations**

```bash
pnpm --filter @yeet2/db exec prisma generate
pnpm --filter @yeet2/db exec prisma db push
```

**5. Set up Brain (Python)**

```bash
cd apps/brain
uv venv
uv pip install -e '.[crewai]'
cd ../..
```

**6. Start services** (each in its own terminal)

```bash
pnpm dev:api
pnpm dev:brain
pnpm dev:control
pnpm dev:executor
```

---

## Operational Commands

**View logs for a service**

```bash
docker compose -f docker-compose.deploy.yml logs -f api
docker compose -f docker-compose.deploy.yml logs -f brain
docker compose -f docker-compose.deploy.yml logs -f executor
```

**Restart a single service**

```bash
docker compose -f docker-compose.deploy.yml restart api
```

**Database backup**

```bash
docker compose -f docker-compose.deploy.yml exec postgres \
  pg_dump -U yeet2 yeet2 > backup-$(date +%Y%m%d).sql
```

**Check autonomy loop status**

Open the project detail page in the Control UI. The autonomy status badge and decision log show the last loop result and next scheduled run.

**Pull updated images (release path)**

```bash
docker compose --env-file .env -f docker-compose.release.yml pull
docker compose --env-file .env -f docker-compose.release.yml up -d
```

---

## Troubleshooting

**Brain unreachable / planning fails**

Check that `YEET2_BRAIN_BASE_URL` in `.env` matches the actual brain address. Inside the compose network the default is `http://brain:3002`. For local dev it should be `http://localhost:3002`.

```bash
docker compose -f docker-compose.deploy.yml logs brain
```

Also verify that role definitions are all enabled on the project — planning requires at least one active role.

**Executor job stuck**

Check `YEET2_OPENHANDS_TIMEOUT_SECONDS` — a blank value means no timeout. View job logs in the Control UI under **Jobs** → select the job.

```bash
docker compose -f docker-compose.deploy.yml logs executor
```

**Worker shows stale in the Workers page**

The executor sends heartbeats every `YEET2_EXECUTOR_HEARTBEAT_INTERVAL_SECONDS` seconds (default 30). If the executor process restarted recently it may take up to two intervals to re-register. If it stays stale, check executor logs.

**Control UI form submissions rejected (CSRF error)**

`YEET2_CONTROL_ORIGIN` must exactly match the URL in your browser, including protocol and port. Example: if you access the UI at `http://10.42.10.101:3000`, set `YEET2_CONTROL_ORIGIN=http://10.42.10.101:3000`.

**Database migration fails on startup**

The `migrate` service runs once and must complete before API or Brain start. Check its logs:

```bash
docker compose -f docker-compose.deploy.yml logs migrate
```
