# yeet2 Spec

## Summary

yeet2 is a self-hosted autonomous software-team platform built as a monorepo.

The MVP stack is:

- SvelteKit + link42-aligned CSS and components for `apps/control`
- Fastify on Node.js for `apps/api`
- Python + CrewAI for `apps/brain`
- Python + OpenHands adapter for `apps/executor`
- PostgreSQL as the system of record
- Redis for queueing and transient coordination where helpful
- Docker Compose for local and initial single-host deployment
- GitHub as the primary external engineering ledger
- Nomad-ready execution abstractions for future distributed fabric

## Core Subsystems

### Control

The web UI and API surface for:

- projects
- constitutions
- missions
- tasks
- blockers
- approvals
- agent activity
- workers
- jobs and artifacts

### Brain

The orchestration layer responsible for:

- reading constitution documents
- generating and refreshing missions and tasks
- coordinating specialist roles
- deciding next actions
- creating blockers when ambiguity or risk requires escalation

### Execution

The adapter layer responsible for:

- repository checkout and isolated worktree setup
- implementation, QA, and review job execution
- artifact and log capture
- replaceable worker backends, with OpenHands first

### Fabric

The execution fabric responsible for:

- worker registration
- capability matching
- leases and heartbeats
- queueing and dispatch
- future mapping to Nomad-backed distributed execution

### Memory

The persistence layer for:

- projects
- constitutions
- missions
- tasks
- blockers
- jobs
- workers
- decision logs

## Constitution Files

Each managed project must expose these files at minimum:

- `docs/VISION.md`
- `docs/SPEC.md`
- `docs/ROADMAP.md`

Recommended additional files:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/QUALITY_BAR.md`

## Specialist Roles

The MVP role set is:

- Planner
- Architect
- Implementer
- QA
- Reviewer
- Visual

Projects may configure role definitions and per-role model selection, but the above role set is the baseline shape for planning and execution.

## Execution Rules

- Do not merge directly to `main`
- Do not perform destructive git operations
- Every implementation task runs in an isolated branch or workspace
- Every job persists logs
- Failed tasks increment attempts
- Tasks that fail twice become blocked
- Every blocker is visible in the UI

## External System Roles

- OpenSpec-style docs ground durable project intent
- CrewAI orchestrates specialist roles in the Brain
- OpenHands is the first coding execution backend behind a yeet2-owned adapter
- GitHub is the primary artifact and collaboration ledger
- Nomad is the intended long-term distributed execution substrate

## Supporting Reference Docs

Use these companion docs for the fuller system picture:

- [ARCHITECTURE.md](/Users/icd/Workspace/nas/yeet2/docs/ARCHITECTURE.md)
- [DATA_FLOWS.md](/Users/icd/Workspace/nas/yeet2/docs/DATA_FLOWS.md)
- [OPERATIONS.md](/Users/icd/Workspace/nas/yeet2/docs/OPERATIONS.md)
- [DEVELOPMENT.md](/Users/icd/Workspace/nas/yeet2/docs/DEVELOPMENT.md)
- [CI_CD.md](/Users/icd/Workspace/nas/yeet2/docs/CI_CD.md)
