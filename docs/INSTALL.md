# yeet2 Installation Guide

## Prerequisites

- Docker Engine and Docker Compose v2 (`docker compose`, not `docker-compose`)
- Git
- An LLM API key (OpenRouter recommended — covers both the Brain planner and Executor)

---

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/wan0net/yeet2/main/install.sh | bash
```

The script clones the repo to `~/yeet2`, walks you through the required config, builds images from source, and starts the stack. All you need upfront is your LLM API key and the host URL.

To install to a custom directory:

```bash
YEET2_DIR=/opt/yeet2 bash <(curl -fsSL https://raw.githubusercontent.com/wan0net/yeet2/main/install.sh)
```

---

## Manual Install

If you prefer to see every step:

**1. Clone**

```bash
git clone https://github.com/wan0net/yeet2.git ~/yeet2
cd ~/yeet2
```

**2. Configure**

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

```dotenv
# The URL you'll use to access the Control UI (must match exactly — used for CSRF)
YEET2_CONTROL_ORIGIN=http://YOUR_HOST_IP:3000

# LLM credentials for the executor agent (OpenHands uses these)
LLM_API_KEY=sk-or-v1-...
LLM_MODEL=openrouter/openai/gpt-4.1-mini
LLM_BASE_URL=https://openrouter.ai/api/v1

# Same key for the Brain planner (CrewAI)
OPENROUTER_API_KEY=sk-or-v1-...

# Optional: protect the API with a bearer token
YEET2_API_BEARER_TOKEN=   # leave blank to disable auth

# Recommended: protect the internal Brain and Executor services
YEET2_BRAIN_BEARER_TOKEN=
YEET2_EXECUTOR_BEARER_TOKEN=

# Optional: dedicated bearer token for Hermes or other external trigger/poll integrations
YEET2_HERMES_BEARER_TOKEN=
```

To use Codex CLI or Claude Code instead of OpenHands:

```dotenv
# Codex CLI
YEET2_EXECUTOR_MODE=codex
OPENAI_API_KEY=sk-...

# Claude Code
YEET2_EXECUTOR_MODE=claude
ANTHROPIC_API_KEY=sk-ant-...
YEET2_CLAUDE_MODEL=sonnet
```

If you want the Docker executor image to install both CLIs during build:

```dotenv
YEET2_INSTALL_CODE_HARNESSES=true
```

**3. Build and start**

```bash
docker compose --env-file .env -f docker-compose.deploy.yml up -d --build
```

**4. Verify**

```bash
curl http://localhost:3001/health   # → {"status":"ok"}
```

**5. Open the UI**

Navigate to the URL you set as `YEET2_CONTROL_ORIGIN`.

---

## Updating

From the install directory:

```bash
git pull
docker compose --env-file .env -f docker-compose.deploy.yml up -d --build
```

Or re-run the install script — it detects an existing repo and pulls:

```bash
bash ~/yeet2/install.sh
```

---

## Using Pre-built Images (GHCR)

If you don't want to build from source, use the release compose file instead:

```bash
docker compose --env-file .env -f docker-compose.release.yml pull
docker compose --env-file .env -f docker-compose.release.yml up -d
```

---

## Ansible Docker Host

Yeet2 also includes a Docker-first Ansible path for provisioning a remote host:

```bash
cd infra/ansible
cp inventory.ini.example inventory.ini
ansible-galaxy collection install -r requirements.yml
ansible-playbook playbook.yml
```

The playbook installs Docker, checks out Yeet2, renders `.env`, and starts either `docker-compose.release.yml` or `docker-compose.deploy.yml`.

Useful variables:

```ini
yeet2_repo_url=https://github.com/wan0net/yeet2.git
yeet2_repo_version=main
yeet2_deploy_dir=/opt/yeet2
yeet2_compose_file=docker-compose.release.yml
yeet2_executor_mode=claude
yeet2_install_code_harnesses=true
```

Keep real API keys in Ansible Vault or pass them via your secret manager; do not commit `inventory.ini`.

For the current Yeet fleet, use `10.42.10.101` as the first control-plane host and leave `10.42.10.100` for Hermes.

---

## Remote Worker Node

After the control plane is running, a second Docker host can run only the Executor:

```bash
cp .env.example .env.worker
```

Set at minimum:

```dotenv
YEET2_API_BASE_URL=http://10.42.10.101:3001
YEET2_EXECUTOR_WORKER_ID=yeet-worker-01
YEET2_EXECUTOR_WORKER_NAME=yeet-worker-01
YEET2_EXECUTOR_WORKER_ENDPOINT=http://10.42.10.102:8021
YEET2_EXECUTOR_MODE=claude
YEET2_API_BEARER_TOKEN=<same token as API>
YEET2_EXECUTOR_BEARER_TOKEN=<executor token>
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...
```

Then start the worker:

```bash
docker compose --env-file .env.worker -f docker-compose.worker.yml pull
docker compose --env-file .env.worker -f docker-compose.worker.yml up -d
```

The API dispatches to healthy registered worker endpoints when they are available. If a remote worker cannot see the API host's `localPath`, the Executor falls back to cloning `repo_url` into its own workspace. For private GitHub repos, set `GITHUB_TOKEN` on the worker or use SSH deploy keys.

Set image overrides in `.env` if you want a specific version:

```dotenv
YEET2_NODE_IMAGE=ghcr.io/wan0net/yeet2-node:latest
YEET2_BRAIN_IMAGE=ghcr.io/wan0net/yeet2-brain:latest
YEET2_EXECUTOR_IMAGE=ghcr.io/wan0net/yeet2-executor:latest
```

---

## Configuration Reference

All variables live in `.env`. Full defaults are in `.env.example`.

### Core

| Variable | Default | Description |
|---|---|---|
| `YEET2_CONTROL_ORIGIN` | `http://localhost:3000` | **Must match the URL in your browser.** SvelteKit uses this for CSRF — forms fail if wrong. |
| `CONTROL_PORT` | `3000` | Host port for the Control UI |
| `API_PORT` | `3001` | Host port for the API |
| `BRAIN_PORT` | `3002` | Host port for the Brain |
| `EXECUTOR_PORT` | `3003` | Host port for the Executor |
| `YEET2_API_BEARER_TOKEN` | _(blank)_ | Bearer token for API write access. Generate: `openssl rand -hex 32`. Leave blank to disable. |
| `YEET2_BRAIN_BEARER_TOKEN` | _(blank)_ | Bearer token for the internal Brain service. Recommended for deploy/release stacks. |
| `YEET2_EXECUTOR_BEARER_TOKEN` | _(blank)_ | Bearer token for the internal Executor service. Recommended for deploy/release stacks. |
| `YEET2_HERMES_BEARER_TOKEN` | _(blank)_ | Optional bearer token for `/integrations/hermes/*`. Falls back to the API bearer token when blank. |

### LLM / Keys

| Variable | Default | Description |
|---|---|---|
| `LLM_API_KEY` | _(required for OpenHands/passthrough)_ | API key for the Executor's OpenHands or passthrough agent |
| `LLM_MODEL` | _(required for OpenHands/passthrough)_ | Model identifier (e.g. `openrouter/openai/gpt-4.1-mini`) |
| `LLM_BASE_URL` | _(required for OpenHands/passthrough)_ | Base URL (e.g. `https://openrouter.ai/api/v1`) |
| `OPENROUTER_API_KEY` | _(blank)_ | OpenRouter key for the Brain planner |
| `OPENAI_API_KEY` | _(blank)_ | OpenAI key alternative for the Brain planner |
| `ANTHROPIC_API_KEY` | _(blank)_ | Anthropic key for Claude Code executor mode |
| `GITHUB_TOKEN` | _(blank)_ | PAT with `repo` scope — required for PR creation and branch push |

### Brain / Planning

| Variable | Default | Description |
|---|---|---|
| `YEET2_BRAIN_PLANNER_BACKEND` | `auto` | `auto` uses CrewAI when enabled, else deterministic. `crewai` forces it. |
| `YEET2_BRAIN_CREWAI_ENABLED` | `false` | Enable CrewAI-backed planning |
| `YEET2_BRAIN_CREWAI_MODEL` | _(blank)_ | Model for CrewAI (e.g. `openrouter/openai/gpt-4.1-mini`) |
| `YEET2_BRAIN_PLAN_TIMEOUT_MS` | `120000` | Planning call timeout (ms) |

### Execution

| Variable | Default | Description |
|---|---|---|
| `YEET2_EXECUTOR_MODE` | `openhands` | Execution adapter (`openhands`, `codex`, `claude`, `local`, or `passthrough`) |
| `YEET2_INSTALL_CODE_HARNESSES` | `false` | Build Codex CLI and Claude Code into the Docker executor image |
| `YEET2_HARNESS_TIMEOUT_SECONDS` | `1800` | Shared timeout for Codex/Claude runs unless overridden |
| `YEET2_OPENHANDS_TIMEOUT_SECONDS` | `1800` | Per-job timeout. Blank = no timeout (risky in production). |
| `YEET2_CODEX_COMMAND` | _(blank)_ | Optional Codex command override; default is `codex exec ... -` |
| `YEET2_CLAUDE_COMMAND` | _(blank)_ | Optional Claude command override; default is `claude -p --bare ...` |
| `YEET2_EXECUTOR_WORKTREE_CLEANUP` | `on_success` | When to clean up git worktrees: `on_success`, `always`, `never` |

### Autonomy

| Variable | Default | Description |
|---|---|---|
| `YEET2_AUTONOMY_LOOP_ENABLED` | `true` | Enable the background autonomy loop |
| `YEET2_AUTONOMY_LOOP_INTERVAL_MS` | `60000` | Loop tick interval (ms) |
| `YEET2_STUCK_JOB_TIMEOUT_MS` | `3600000` | Jobs running longer than this (ms) are force-failed |

---

## Register Your First Project

1. Open the Control UI → **Projects → Add project**
2. Enter a name, GitHub repo URL, and default branch
3. Submit — the API clones the repo and links GitHub metadata
4. Open the project detail. Enable **GitHub sync** and click **Pull GitHub issues**
5. Once issues are imported, the project is ready for ticket-driven execution

Reference docs are read from the `docs/` directory of the registered repo when present, but GitHub issues are the work queue.

---

## Forgeyard (yeet2 dogfooding itself)

To register yeet2 as its own project on a fresh install:

1. Set `YEET2_PROJECTS_DIR=/var/lib/yeet2/projects` in `.env` (already the default in compose files)
2. Register via the UI: name `forgeyard`, repo `https://github.com/wan0net/yeet2`, branch `main`
3. Set autonomy to **Supervised** before the first ticket run
4. Create or choose a GitHub issue, then click **Pull GitHub issues**

---

## Verifying Health

```bash
curl http://localhost:3001/health   # API
docker compose -f docker-compose.deploy.yml ps
```

In deploy/release compose stacks, Brain and Executor stay on the internal Docker network and are not published on host ports by default.

In the UI:
- **Workers page** — executor should appear as online
- **Project → Constitution** — pills for detected files
- **Chat tab** — agents post progress messages here as they work
- **Tickets page** — decision, escalation, work, and execution tickets are the operating queue
- **Project overview → GitHub sync** — enable sync and click **Pull GitHub issues** to import GitHub issues as Yeet tickets

For GitHub-source-of-truth operation, configure the GitHub PAT in **Settings**, register projects with GitHub repo URLs, and keep work intake in GitHub issues. Yeet imports issues into project tickets, routes work to capable workers, and posts progress back to linked GitHub issues.

---

## Operational Commands

```bash
# Logs for a specific service
docker compose -f docker-compose.deploy.yml logs -f api

# Restart a service
docker compose -f docker-compose.deploy.yml restart api

# Database backup
docker compose -f docker-compose.deploy.yml exec postgres \
  pg_dump -U yeet2 yeet2 > backup-$(date +%Y%m%d).sql

# Pull updated images (release path only)
docker compose --env-file .env -f docker-compose.release.yml pull
docker compose --env-file .env -f docker-compose.release.yml up -d
```

---

## Local Development

Only infra runs in Docker. Services run as local processes.

```bash
# Start postgres + redis
docker compose up -d

# Install Node deps
pnpm install

# Generate Prisma client and push schema
pnpm --filter @yeet2/db exec prisma generate
pnpm --filter @yeet2/db exec prisma db push

# Start each service in its own terminal
pnpm dev:api
pnpm dev:brain
pnpm dev:control
pnpm dev:executor
```

---

## Troubleshooting

**Forms rejected (CSRF error)**
`YEET2_CONTROL_ORIGIN` must exactly match the URL in your browser including protocol and port.

**Brain unreachable / planning fails**
Inside compose the default is `http://brain:3002`. For local dev use `http://localhost:3002`. Check `docker compose logs brain`.

**Executor job stuck**
Check `YEET2_OPENHANDS_TIMEOUT_SECONDS`. View logs in the UI under **Jobs** → select the job, or `docker compose logs executor`.

**Worker stays stale**
Executor sends heartbeats every `YEET2_EXECUTOR_HEARTBEAT_INTERVAL_SECONDS` seconds (default 30). Wait two intervals; if still stale, check executor logs.

**Migration fails on startup**
`migrate` must complete before API/Brain start. Check: `docker compose -f docker-compose.deploy.yml logs migrate`.
