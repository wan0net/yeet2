# yeet2

Self-hosted autonomous team platform. Define a project, attach a pipeline of specialist agents, and let yeet2 plan, execute, review, and ship — continuously.

While the alpha focuses on software development, the architecture is domain-agnostic. Any multi-stage knowledge work pipeline (content, architecture, research, compliance) can be modelled as a sequence of roles operating on a shared repository.

**Live dogfood**: `forgeyard` — yeet2 managing its own development on `10.42.10.101`.

## Current Release: v0.1.0-alpha

### Core Features

- [x] Project registration (clone from URL or attach local path)
- [x] Constitution detection and inspection (VISION.md, SPEC.md, ROADMAP.md + optional files)
- [x] Chat-driven constitution interview (5-question guided setup with LLM synthesis)
- [x] Constitution editor with live markdown preview
- [x] Deterministic and CrewAI-backed mission planning
- [x] 7-stage TDD pipeline: Architect → Implementer → Tester → Coder → QA → Reviewer → (Visual)
- [x] Stage-aware dispatch with role ranking
- [x] Autonomy modes: Manual, Supervised, Autonomous
- [x] Job execution via OpenHands in isolated git worktrees
- [x] Job logs and artifact summaries
- [x] Blocker creation, resolution, and dismissal
- [x] Approval approve/reject workflow
- [x] Pull request creation and merge automation
- [x] Structured QA/reviewer verdict recording
- [x] Stuck job recovery with configurable timeout
- [x] Worker heartbeat and registry
- [x] Markdown rendering across the UI
- [x] Chatroom-style project chat with agent bubbles
- [x] Top navbar + per-project sidebar navigation
- [x] GitHub PAT management via Settings UI
- [x] 21 agent name themes (Star Trek, Star Wars, Stargate, LOTR, Dune, Firefly, and more)
- [x] Character personalities injected into agent stage briefs
- [x] Getting Started guide (in-app + docs site)
- [x] Installation guide (INSTALL.md)
- [x] Docker deployment with health checks for all services
- [x] CI/CD: typecheck, build, Semgrep, Trivy, GHCR multi-arch publishing
- [x] 251+ tests across all services (Vitest + pytest)
- [x] Error feedback and graceful API-down handling across all pages
- [x] OpenRouter model catalog with live pricing

### Beta Roadmap

**Agent Experience & Visualization**
- [ ] **Mission Control dashboard** — real-time grid of all active agents across projects with status (Cursor 2.0 style)
- [ ] **Live pipeline graph** — active node pulses, completed nodes glow green, animated handoffs
- [ ] **Mid-task chat steering** — talk to agents while they work, redirect without canceling (OpenHands/Devin style)
- [ ] **Chunked progress summaries** — narrative updates during execution, not just raw logs
- [ ] **Spatial agent visualization** — characters in themed environments: Star Trek bridge, LOTR war table, The Office floor (Smallville style)
- [ ] **Execution trace timeline** — step-by-step visual replay of agent actions (LangGraph style)

**GitHub Integration**
- [ ] **GitHub Projects + Issues kanban** — missions as project boards, tasks as issues, stage transitions move cards
- [ ] **Webhook support** — GitHub webhook receiver for two-way sync

**Generic Pipeline Platform**
- [ ] **Pluggable execution adapters** — passthrough, document, research, shell beyond code-only
- [ ] **Visual flow editor** — n8n/NiFi-style node canvas with drag-and-drop, branching, loops with exit conditions
- [ ] **Pipeline templates** — pre-built pipelines for content, architecture, marketing, legal, data, research
- [ ] **Chat-driven pipeline design** — interview that builds both constitution and pipeline
- [ ] **pipeline.yml** — config-as-code pipeline definition

**Extensibility**
- [ ] **Agent Skills / plugins** — SKILL.md standard for extending agent capabilities (web search, screenshots, API calls)
- [ ] **External triggers** — start work from GitHub Issues, Slack, webhooks, CLI
- [ ] **Agent verification artifacts** — screenshots, test output, demo recordings to prove work

**Observability**
- [ ] **Langfuse integration** — self-hosted LLM observability with traces, cost dashboards, quality scoring
- [ ] **Audit log** — searchable history of every autonomy decision
- [ ] **Cost tracking** — per-project and per-role LLM spend from OpenRouter + Langfuse

**Operator Tools**
- [ ] **Custom roles** — create, rename, reorder roles beyond the defaults
- [ ] **Role editor UI** — drag-to-reorder, per-role model/adapter/character config
- [ ] **Improved constitution interview** — follow-up questions, generate all 6 files
- [ ] **Worker pool** — multiple executor instances with load balancing
- [ ] **Database migrations** — `prisma migrate deploy` instead of `prisma db push`

### Future (Post-Beta)

- [ ] Multi-tenant / multi-user auth
- [ ] Nomad-backed distributed execution
- [ ] Container-level sandboxing
- [ ] Real-time websocket updates
- [ ] Plugin system for custom adapters

## Architecture

```
apps/control      SvelteKit web UI
apps/api          Fastify REST API + autonomy loop
apps/brain        Python planning service (CrewAI + deterministic)
apps/executor     Python execution adapter (OpenHands)
packages/db       Prisma schema (PostgreSQL)
packages/domain   Shared types, model defaults, agent themes
packages/constitution  Constitution file discovery and parsing
infra/docker      Dockerfiles and deployment scripts
docs/             Product specs, architecture, operations
```

## Quick Start

```bash
git clone https://github.com/wan0net/yeet2.git && cd yeet2
cp .env.example .env
# Edit .env: set YEET2_CONTROL_ORIGIN, LLM_API_KEY, LLM_MODEL, LLM_BASE_URL

# Build-on-host deployment:
docker compose --env-file .env -f docker-compose.deploy.yml up -d --build

# Or pull pre-built images:
docker compose --env-file .env -f docker-compose.release.yml pull
docker compose --env-file .env -f docker-compose.release.yml up -d
```

Open `http://localhost:3000` → follow the Getting Started guide.

See [docs/INSTALL.md](./docs/INSTALL.md) for full setup instructions.

## Documentation

| Doc | Purpose |
|---|---|
| [INSTALL.md](./docs/INSTALL.md) | Step-by-step deployment guide |
| [GETTING_STARTED.md](./docs/GETTING_STARTED.md) | First project walkthrough |
| [VISION.md](./docs/VISION.md) | Project purpose and principles |
| [SPEC.md](./docs/SPEC.md) | Technical specification |
| [PRODUCT_SPEC.md](./docs/PRODUCT_SPEC.md) | MVP product definition |
| [ROADMAP.md](./docs/ROADMAP.md) | Milestone breakdown |
| [BETA_SPEC.md](./docs/BETA_SPEC.md) | Beta release specification |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Service map and deployment |
| [DATA_FLOWS.md](./docs/DATA_FLOWS.md) | Sequence diagrams for all flows |
| [OPERATIONS.md](./docs/OPERATIONS.md) | Operator runtime guide |
| [DEVELOPMENT.md](./docs/DEVELOPMENT.md) | Local development setup |
| [CI_CD.md](./docs/CI_CD.md) | GitHub Actions and GHCR publishing |
| [DECISIONS.md](./docs/DECISIONS.md) | Implementation decisions log |

## License

BSD-3-Clause
