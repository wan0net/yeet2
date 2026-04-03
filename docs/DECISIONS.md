# yeet2 Decisions Log

## Purpose

This document records implementation decisions for yeet2.

It is especially required when implementation deviates from the default stack or architectural direction defined in `docs/PRODUCT_SPEC.md`.

## Decision Policy

Implement against the specified stack unless there is a strong technical reason not to.

If a deviation is made, document it here before or alongside the implementation change.

## Decision Template

Use the following format for each decision:

### DECISION-XXX: Short Title

- Date: `YYYY-MM-DD`
- Status: `proposed | accepted | superseded | rejected`
- Area: `frontend | api | brain | executor | fabric | memory | infra | other`
- Spec Default: `<the default called for in docs/PRODUCT_SPEC.md>`
- Chosen Approach: `<the implementation actually used>`
- Reason: `<why the deviation or decision was necessary>`
- Consequences: `<tradeoffs, risks, migration implications>`

## Initial Decisions

No implementation deviations recorded yet.

### DECISION-001: Local Repo Attachment First

- Date: `2026-04-02`
- Status: `superseded`
- Area: `api`
- Spec Default: `yeet2 clones or attaches the repository locally`
- Chosen Approach: `Milestone 2 supports attaching an existing local repository path first; clone orchestration is deferred`
- Reason: `The open clone-vs-mount question is unresolved, and local attachment unblocks project registration without overcommitting the execution model`
- Consequences: `Registration initially required a valid local path in the MVP. This decision is superseded by DECISION-004, which adds repoUrl-driven clone support behind the same registration surface`

### DECISION-002: Deterministic Planning Fallback

- Date: `2026-04-02`
- Status: `accepted`
- Area: `brain`
- Spec Default: `CrewAI is the initial orchestration framework for specialist roles`
- Chosen Approach: `Milestone 3 keeps a deterministic planning fallback in the Brain service behind the same mission and task contract that CrewAI will use`
- Reason: `This keeps the planning loop moving for the MVP while the CrewAI integration boundary is still being established`
- Consequences: `Initial mission and task generation can remain rule-based during the transition; the same contract should later be driven by CrewAI without changing the API shape`

### DECISION-003: OpenHands Via Headless CLI Adapter

- Date: `2026-04-02`
- Status: `accepted`
- Area: `executor`
- Spec Default: `Executor uses OpenHands as the first implementation backend behind a yeet2-owned adapter`
- Chosen Approach: `Executor prepares the yeet2-owned worktree locally, then invokes OpenHands as a headless subprocess through an env-configurable CLI command that defaults to uvx with Python 3.12 and the documented openhands package/executable`
- Reason: `The adapter boundary stays clean and replaceable, while the subprocess path avoids embedding OpenHands as a library inside the service. This host currently has system Python 3.14, which OpenHands does not support, so the default command uses uvx to provision a Python 3.12 runtime without changing the system interpreter. Headless CLI mode also matches the current synchronous HTTP flow and gives straightforward stdout/stderr log capture. The executor also passes --override-with-envs so env-based settings such as LLM_API_KEY, LLM_MODEL, and LLM_BASE_URL are honored by the subprocess.`
- Consequences: `The executor now depends on host runtime setup for uv/uvx and OpenHands model configuration. Startup failures are surfaced as job failures instead of crashing the service, and an explicit local-only fallback mode remains available for development. If the project later needs tighter lifecycle control or richer streaming state, the adapter can be swapped to a different backend without changing the API contract.`

### DECISION-004: Project Registration Supports Attach Or Clone

- Date: `2026-04-02`
- Status: `accepted`
- Area: `api`
- Spec Default: `yeet2 clones or attaches the repository locally`
- Chosen Approach: `Project registration now accepts either an explicit localPath attachment or a repoUrl that the API clones into a managed base directory controlled by YEET2_PROJECTS_DIR`
- Reason: `Local attachment remains useful for existing checkouts, but repoUrl-first registration is needed to make onboarding smoother and align the API with the product expectation that yeet2 can prepare a local working copy itself`
- Consequences: `The registration surface now branches between attach and clone flows while keeping the same upsert and constitution-inspection behavior. Clone targets are derived from a safe repo-based directory name, reused only when the existing checkout matches the same repo remote, and never overwritten in place. Operators can relocate managed clones with YEET2_PROJECTS_DIR, which defaults to /tmp/yeet2-projects`

### DECISION-005: Persist GitHub References On Write

- Date: `2026-04-03`
- Status: `accepted`
- Area: `api`
- Spec Default: `GitHub references may be derived when needed`
- Chosen Approach: `Project registration now stores GitHub repo owner, repo name, and canonical web URL when repoUrl targets GitHub, and dispatched jobs store a canonical compare URL for the branch they ran on`
- Reason: `The API already had enough context at write time to persist stable artifact links, which reduces repeated URL derivation at render time and keeps the stored records closer to the engineering artifact they represent`
- Consequences: `Existing rows will retain null GitHub metadata until they are rewritten or backfilled, but new and updated records now preserve the canonical GitHub references alongside the project/job data`

### DECISION-006: Repo-Local CrewAI Runtime For Brain

- Date: `2026-04-03`
- Status: `accepted`
- Area: `brain`
- Spec Default: `CrewAI is the initial orchestration framework for specialist roles`
- Chosen Approach: `The default local Brain runtime uses a dedicated virtualenv at apps/brain/.venv and keeps CrewAI home and storage state under apps/brain/.home and apps/brain/.crewai-data`
- Reason: `A repo-local runtime keeps Brain setup reproducible, avoids leaking CrewAI state into the operator's global environment, and lets pnpm dev:brain work against the installed CrewAI path without extra shell setup`
- Consequences: `Local Brain bootstrap now expects uv to create and populate apps/brain/.venv. Repo-local runtime artifacts must stay ignored in git, and operators can still override HOME or CREWAI_STORAGE_DIR if they need a different path`

### DECISION-007: Executor Uses Repo-Owned ASRT Sandbox Wrapper

- Date: `2026-04-03`
- Status: `accepted`
- Area: `executor`
- Spec Default: `Container-based sandboxing is preferred when practical, but full remote sandboxing is not required for MVP`
- Chosen Approach: `The executor keeps the yeet2-owned local worktree flow and adds an ASRT-backed sandbox mode controlled by YEET2_EXECUTOR_SANDBOX_* env vars, rendering a yeet2-owned per-job config and optionally merging a base JSON policy file before launching OpenHands through srt`
- Reason: `This keeps sandbox policy under yeet2 control, fits the existing synchronous subprocess model, and borrows the sharkcage-style pattern of generating isolated config per job instead of relying on a shared operator-managed sandbox file`
- Consequences: `ASRT mode adds a host dependency on srt plus sandbox config management, but it keeps executor behavior compatible with the current OpenHands adapter, leaves sandbox mode optional for local development, and keeps older YEET2_ASRT_* names as compatibility aliases rather than the primary interface`

### DECISION-008: Control App Moves From Next.js To SvelteKit

- Date: `2026-04-03`
- Status: `accepted`
- Area: `frontend`
- Spec Default: `Next.js for apps/control`
- Chosen Approach: `apps/control is migrated to SvelteKit with adapter-node so yeet2 can align directly with the existing link42 platform libraries, theme tokens, layout patterns, and component language`
- Reason: `The operator requested full UI alignment with link42, and link42 itself is built on SvelteKit with a shared token and component system. Matching that platform directly is the most reliable way to achieve true parity instead of approximating it inside a separate Next.js stack`
- Consequences: `This is a deliberate frontend-stack deviation from the original MVP spec. The Fastify API, Brain, Executor, and domain contracts remain unchanged, but the control app now shares the same platform direction as link42. Deployment and local runtime expectations for apps/control now follow SvelteKit rather than Next.js`
