# Go To Woah: Running A Software Engineering Project

This is the shortest reliable path from a blank host to yeet2 running a software engineering project end to end.

## 1. Choose The Execution Harness

Set one executor mode before starting the stack:

| Mode | Best for | Required local/container tool |
|---|---|---|
| `openhands` | default autonomous coding path | `uvx` plus OpenHands package |
| `codex` | OpenAI Codex CLI as the coding harness | `codex` CLI |
| `claude` | Claude Code non-interactive coding harness | `claude -p` |
| `local` | dry-run worktree preparation | Git only |
| `passthrough` | text-only planning or document stages | OpenAI-compatible API key |

For Docker builds that should include Codex CLI and Claude Code, set:

```dotenv
YEET2_INSTALL_CODE_HARNESSES=true
```

For an already-provisioned host or custom image, leave that off and set `YEET2_CODEX_COMMAND` or `YEET2_CLAUDE_COMMAND` if the binaries are not on `PATH`.

## 2. Configure `.env`

```bash
cp .env.example .env
```

Minimum production-ish settings:

```dotenv
YEET2_CONTROL_ORIGIN=http://YOUR_HOST:3000
GITHUB_TOKEN=ghp_...

YEET2_API_BEARER_TOKEN=<openssl rand -hex 32>
YEET2_BRAIN_BEARER_TOKEN=<openssl rand -hex 32>
YEET2_EXECUTOR_BEARER_TOKEN=<openssl rand -hex 32>

YEET2_EXECUTOR_MODE=codex
OPENAI_API_KEY=sk-...
```

Claude mode:

```dotenv
YEET2_EXECUTOR_MODE=claude
ANTHROPIC_API_KEY=sk-ant-...
YEET2_CLAUDE_MODEL=sonnet
```

OpenHands mode:

```dotenv
YEET2_EXECUTOR_MODE=openhands
LLM_API_KEY=sk-or-v1-...
LLM_MODEL=openrouter/openai/gpt-5.1-codex-mini
LLM_BASE_URL=https://openrouter.ai/api/v1
```

## 3. Start The Stack

Build from source:

```bash
docker compose --env-file .env -f docker-compose.deploy.yml up -d --build
```

Or run prebuilt images:

```bash
docker compose --env-file .env -f docker-compose.release.yml pull
docker compose --env-file .env -f docker-compose.release.yml up -d
```

## 4. Verify Health

```bash
docker compose --env-file .env -f docker-compose.deploy.yml ps
curl http://localhost:3001/health
```

In the UI:

1. Open `YEET2_CONTROL_ORIGIN`
2. Go to **Workers**
3. Confirm the executor is online and reports the expected executor type/capabilities

## 5. Register The Repo

1. Open **Projects → Add project**
2. Enter project name
3. Enter a GitHub repo URL and default branch
4. Choose the software pipeline template
5. Submit

Repo URL registration is the preferred Docker path because API and Executor share the managed `projects_data` volume. If you attach a host checkout by local path, mount that exact path into both API and Executor containers.

GitHub is the work source of truth. After registration, open the project overview, enable **GitHub sync**, then click **Pull GitHub issues**. Yeet imports repository issues into the **GitHub source-of-truth inbox** mission, keeps the GitHub issue number on each ticket, and reports agent progress back to that issue when work runs. Agents can also emit delegated ticket suggestions; Yeet turns those into linked GitHub issues and pulls them into the same queue.

## Fleet Layout

For the existing Yeet machines:

- `10.42.10.100` stays dedicated to Hermes.
- `10.42.10.101` runs the Yeet2 control plane and can also run the first executor.
- A later worker, for example `10.42.10.102`, runs `docker-compose.worker.yml` and advertises `YEET2_EXECUTOR_WORKER_ENDPOINT=http://10.42.10.102:8021`.

Workers register with the API and heartbeat their executor mode/capabilities. Dispatch prefers healthy role-capable workers, falls back to any healthy git-capable worker, then falls back to `YEET2_EXECUTOR_BASE_URL`.

## 6. Add Reference Context

yeet2 works best when the repo contains:

- `docs/VISION.md`
- `docs/SPEC.md`
- `docs/ROADMAP.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/QUALITY_BAR.md`

These files are reference context for agents. They are helpful, but they do not drive the queue; GitHub issues do.

## 7. Run The Project

Recommended first run:

1. Set autonomy to **Supervised**
2. Create a GitHub issue describing the desired outcome
3. Click **Pull GitHub issues**
4. Open **Tickets**
5. Watch the imported ticket move through execution, PR creation, and completion
6. Drill into **Jobs** only when you need raw logs, branches, artifacts, or worker details

When the first full mission succeeds, move to **Autonomous** only after checking:

- PR creation works
- executor logs are visible
- failed jobs become escalation tickets
- branch cleanup policy matches your risk appetite
- bearer tokens are set on API, Brain, and Executor

## 8. Ship And Operate

Daily loop:

1. Triage backlog, bugs, security findings, and follow-up work in GitHub issues
2. Open the Yeet project overview and click **Pull GitHub issues**
3. Work **Tickets** from top to bottom as Yeet turns imported issues into agent tasks
4. Read project **Chat** for planner handoffs and decision history
5. Use **Jobs** for failed execution traces and **Workers** if the queue is not moving

Recovery loop:

```bash
docker compose --env-file .env -f docker-compose.deploy.yml logs -f executor
docker compose --env-file .env -f docker-compose.deploy.yml logs -f api
docker compose --env-file .env -f docker-compose.deploy.yml restart executor
```
