# yeet2 MVP Product Spec

## Summary

yeet2 is a self-hosted autonomous software-team platform.

It manages software projects from a defined project constitution, continuously plans work from that constitution, dispatches specialist agents to execute tasks, and escalates to humans only when needed.

yeet2 is a new project. It may borrow ideas from Yeet, especially around distributed execution and machine-aware job routing, but it should be implemented as a fresh system with clear internal abstractions.

## Product Intent

yeet2 exists to let an operator define a software project once, then have an autonomous system continue planning, implementing, testing, reviewing, and refining that project over time.

The operator should not need to micromanage day-to-day work.

The system should:

- understand a project constitution
- generate and maintain backlog items
- assign work to specialist agents
- execute jobs on appropriate workers
- persist all state and decisions
- request human input only when ambiguity or risk requires it

## Primary Use Case

A technical operator runs yeet2 on a self-hosted machine and attaches one or more software repositories.

For each attached project, yeet2 should:

1. read the project constitution
2. derive meaningful tasks from the roadmap and current codebase state
3. assign those tasks to specialist agents
4. execute implementation and validation jobs
5. produce artifacts, logs, and blockers
6. continue progressing the project over time

## Example Project

Use an internal example project named `forgeyard` for dogfooding.

`forgeyard` is a control plane for autonomous software teams and project missions.

## Relationship to Yeet

yeet2 is a new project.

It may reuse or borrow the following ideas from Yeet:

- machine-aware execution routing
- distributed job placement
- worker capability matching
- orchestration across heterogeneous machines

yeet2 should not be blocked by needing to import Yeet code.
The initial implementation should be independent, with clean internal abstractions.

## Deployment Target

Initial deployment target:

- single host at `10.42.10.101`

Initial runtime mode:

- self-hosted
- single-node control plane
- local execution by default
- ability to evolve toward distributed workers later

## External Software and Their Roles

yeet2 must be built around the following external tools and responsibilities.

### OpenSpec

Use **OpenSpec** as the conceptual basis for project constitutions and spec-driven development.

OpenSpec is responsible for:

- defining the project constitution structure
- grounding work in durable project documents
- keeping planning aligned to explicit project intent rather than ephemeral prompts

In yeet2, OpenSpec-style project files are the source of truth for project intent.

### CrewAI

Use **CrewAI** as the specialist-agent orchestration framework.

CrewAI is responsible for:

- defining specialist roles
- coordinating planner, architect, implementer, QA, reviewer, and visual agents
- running the project work loop
- deciding task assignment and progression

CrewAI belongs in the yeet2 Brain service.

### OpenHands

Use **OpenHands** as the initial coding execution worker.

OpenHands is responsible for:

- carrying out repository implementation work
- making code changes in isolated workspaces or branches
- running local coding workflows
- producing outputs for QA and review

OpenHands belongs behind the yeet2 Executor service as a replaceable adapter.

### Nomad

Use **Nomad** as the intended long-term distributed execution fabric.

Nomad is responsible for:

- worker placement
- machine capability matching
- queueing and dispatching jobs to appropriate machines
- scaling execution beyond a single box

For the MVP, Nomad integration may be deferred behind a clean execution abstraction, but the architecture must be designed so Nomad can become the real execution substrate without a major rewrite.

### GitHub

Use **GitHub** as the project work ledger and collaboration plane.

GitHub is responsible for:

- repository hosting
- issues as durable work items or backlog references
- pull requests as merge/review artifacts
- comments as escalation and blocker surfaces
- traceable history of project changes

For MVP, GitHub may be integrated minimally, but yeet2 should be designed with GitHub as the primary external project system.

## Goals

The MVP must support:

1. Project registration
2. Constitution ingestion
3. Mission and task generation
4. Specialist agent orchestration
5. Implementation job execution against a real repository
6. QA/review stages
7. Blocker generation and human escalation
8. Minimal web UI for visibility and control
9. Persistent state and logs

## Non-Goals

For the MVP, do not build:

- multi-tenant SaaS
- billing
- advanced RBAC/SSO
- fully automated production deployment
- polished chat interfaces
- cross-cluster distributed execution
- perfect long-term autonomous planning
- full import of old Yeet internals

## Core Architecture

yeet2 consists of five subsystems.

### 1. yeet2 Control

A web UI and API for:

- projects
- constitutions
- missions
- tasks
- blockers
- approvals
- agent activity
- job history

It should also include a project-level agent presence view that gives the operator a playful, at-a-glance sense of where specialist agents are and what they are doing. The MVP does not need 3D; a lightweight 2D board, map, timeline, or panel treatment is acceptable if it makes agent state easy to read.

### 2. yeet2 Brain

The orchestration layer responsible for:

- reading project constitutions
- generating tasks from roadmap/spec
- assigning work to specialist roles
- deciding next actions
- detecting blockers
- requesting human input when necessary

Use CrewAI here.
This service is the control-plane intelligence of yeet2.

### 3. yeet2 Execution

Execution adapters responsible for:

- repository checkout and workspace setup
- implementation jobs
- QA jobs
- review jobs
- artifact and log capture

Use OpenHands here as the first implementation backend.
OpenHands must be accessed through a yeet2-owned adapter interface so that the execution backend can be replaced later.

### 4. yeet2 Fabric

The execution fabric responsible for:

- worker registration
- capability matching
- queueing
- retries
- leases and heartbeats
- job dispatch

Design this layer so Nomad becomes the long-term real execution fabric.
For MVP, it may run in local mode with a local dispatcher and job runner, but the interfaces must clearly map to future Nomad-backed execution.

### 5. yeet2 Memory

Persistence layer for:

- projects
- constitutions
- missions
- tasks
- blockers
- job runs
- decision logs
- execution artifacts metadata

## Design Principles

yeet2 should be built as a control plane first, execution fabric second.

This means:

- project and mission state must be explicit
- work must be durable and replayable
- execution backends must be replaceable
- orchestration must not be tightly coupled to one agent runtime
- constitutions must remain the source of truth

## Implementation Defaults

### Core Languages

- TypeScript for web UI, API, and most control-plane services
- Python for agent orchestration and OpenHands integration where that is the path of least resistance

### Monorepo and Package Management

- pnpm workspace for TypeScript packages and apps
- one repository containing all MVP services

### Frontend

- Next.js for `apps/control`
- React for UI
- Tailwind CSS for basic styling
- shadcn/ui may be used for fast internal UI composition

### API

- Node.js with Fastify for `apps/api`
- prefer Fastify unless a strong reason emerges to use another framework
- OpenAPI-compatible API design where practical

### Brain / Orchestration

- Python service for `apps/brain`
- CrewAI as the orchestration framework for specialist roles
- the Brain should expose a small internal HTTP API for triggering and monitoring orchestration flows

### Execution Adapter

- Python service for `apps/executor`
- OpenHands as the first implementation worker
- the Executor should abstract worker execution behind a yeet2-owned interface so OpenHands can be replaced later

### Database

- PostgreSQL as the system of record
- Prisma or Drizzle may be used on the TypeScript side
- keep the schema simple and explicit

### Queue / Cache

- Redis for queueing, transient coordination, and caching if required
- do not build the MVP around Redis-specific assumptions

### Local Orchestration

- Docker Compose for local development and initial deployment on `10.42.10.101`

### Distributed Execution

- Nomad is the intended long-term execution fabric
- the MVP should be Nomad-ready, even if Nomad is initially stubbed or partially integrated

### Repository Operations

- Git CLI for branch, checkout, and workspace operations
- no destructive git commands without explicit policy allowance

### Authentication

- for MVP, use a minimal local-only auth model or no auth if the system is exposed only on a trusted internal network
- auth boundaries must still be designed so a stronger auth model can be added later

### Observability

- structured logs for all services
- basic request and job tracing
- simple log visibility in the control UI
- full observability stack is not required in MVP

### Project Constitution Parsing

- project constitutions are markdown documents stored in each managed project repo
- initial parsing may be file-based and deterministic
- semantic indexing can be added later

### Execution Isolation

- each implementation task should run in an isolated branch or workspace
- container-based sandboxing is preferred when practical
- full remote sandboxing is not required for MVP

### Control Surface

- the MVP primary interface is the yeet2 web UI
- chat interfaces may be added later
- OpenClaw integration is optional later, but yeet2 must not depend on OpenClaw for the MVP

## Preferred Initial Stack Summary

- Frontend: Next.js + React + Tailwind
- API: Fastify on Node.js
- Brain: Python + CrewAI
- Executor: Python + OpenHands adapter
- Constitution model: OpenSpec-style docs in repo
- Work ledger: GitHub
- DB: PostgreSQL
- Cache/Queue: Redis
- Local deploy: Docker Compose
- Future execution fabric: Nomad

## Stack Adherence Policy

Implementation should follow the specified stack in this document by default.

Deviations are allowed only when there is a strong technical reason, such as:

- a required integration is materially incompatible with the preferred stack
- the preferred tool cannot satisfy an MVP-critical requirement without disproportionate complexity
- operational reliability, maintainability, or safety would be meaningfully worse if the preferred tool were forced

Any deviation from the specified stack must be documented explicitly in `docs/DECISIONS.md`.

Each such decision must record:

- the original default from this spec
- the chosen deviation
- the reason for the deviation
- the impact on architecture, operations, and future migration
- the date and status of the decision

## Project Constitution

Each managed project must support these files at minimum:

- `docs/VISION.md`
- `docs/SPEC.md`
- `docs/ROADMAP.md`

Optional but strongly recommended:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/QUALITY_BAR.md`

The Brain must treat these files as the project constitution and source of truth.

## Core Domain Objects

### Project

Represents one software project managed by yeet2.

Fields:

- id
- name
- repo_url
- default_branch
- local_path
- constitution_status
- status
- created_at
- updated_at

### Constitution

Represents the parsed state of the project constitution.

Fields:

- project_id
- vision_path
- spec_path
- roadmap_path
- architecture_path
- decisions_path
- quality_bar_path
- parse_status
- last_indexed_at

### Mission

Represents a bounded initiative for a project.

Fields:

- id
- project_id
- title
- objective
- status
- created_by
- started_at
- completed_at

### Task

Represents a concrete piece of work.

Fields:

- id
- mission_id
- title
- description
- agent_role
- status
- priority
- acceptance_criteria
- attempts
- blocker_reason

### Job

Represents one dispatched execution unit.

Fields:

- id
- task_id
- executor_type
- workspace_path
- branch_name
- status
- log_path
- artifact_summary
- started_at
- completed_at

### Blocker

Represents a human-facing clarification or decision request.

Fields:

- id
- task_id
- title
- context
- options
- recommendation
- status
- created_at
- resolved_at

## Agent Roles

Implement these first-class roles for MVP.

### Planner

Responsibilities:

- read the constitution
- generate and refine tasks
- prioritize work
- keep tasks aligned to roadmap and current repo state
- create blockers when the spec is unclear

### Architect

Responsibilities:

- validate technical direction
- identify architectural conflicts
- constrain implementation scope

### Implementer

Responsibilities:

- execute coding tasks
- work in isolated workspaces or branches
- produce diffs, branches, and logs
- summarize changes made

### QA

Responsibilities:

- run tests
- identify regressions
- add or propose missing test coverage
- mark tasks as failed or incomplete when acceptance criteria are unmet

### Reviewer

Responsibilities:

- compare implementation against acceptance criteria
- identify correctness and maintainability risks
- request follow-up changes when needed

### Visual

Optional for UI-heavy projects.

Responsibilities:

- review visual/UX implementation quality
- ensure UI work aligns with project intent and usability expectations

## MVP Workflow

Implement this exact flow:

1. Operator creates a project in yeet2 Control.
2. yeet2 clones or attaches the repository locally.
3. yeet2 reads and indexes the constitution files.
4. Planner creates an initial mission from the roadmap/spec.
5. Planner generates at least 3 concrete tasks.
6. Architect validates the first task.
7. Implementer dispatches the first coding task through the execution adapter.
8. OpenHands executes the task in an isolated workspace or branch.
9. QA runs verification on the result.
10. Reviewer records outcome.
11. If blocked, a blocker is created and surfaced in UI.
12. All mission, task, and job state remain visible in the UI.

## GitHub Integration Expectations

For MVP, GitHub integration should support at least:

- linking a project to a GitHub repository
- storing repo metadata
- preparing work to align with future issue and PR integration

If feasible, also support:

- creating issues for blockers
- recording branch/PR metadata in yeet2

GitHub should be treated as the long-term external system of record for engineering workflow artifacts.

## Minimal UI Requirements

### Projects Page

Shows:

- project name
- repo
- constitution status
- active mission count
- active task count
- blocker count

### Project Detail Page

Shows:

- constitution file status
- active mission
- tasks by state
- recent jobs
- blockers

### Agent View

Shows:

- specialist agent role
- current or last-known task
- agent status such as running, idle, blocked, or completed
- recent output or activity summary
- project-level grouping so the operator can quickly see the crew at work

This view should feel fun and alive, but still fit the internal tool tone of yeet2.

### Mission Detail Page

Shows:

- mission objective
- task list
- task status
- assigned role
- recent job runs
- result summaries

### Blockers Page

Shows:

- blocker title
- project
- task
- context
- options
- recommendation
- resolution state

### Jobs Page

Shows:

- job status
- executor
- workspace/branch
- timestamps
- logs/artifacts summary

No advanced design polish is required for MVP.

## Execution Rules

For MVP:

- do not merge directly to `main`
- do not perform destructive git operations
- every implementation task must run in an isolated branch or workspace
- every job must persist logs
- every failed task increments attempts
- any task that fails twice becomes blocked
- every blocker must be visible in the UI

## Technical Constraints

- self-hosted only
- must run on `10.42.10.101`
- use open-source components where possible
- Postgres is the primary datastore
- Redis may be used for queueing/caching
- CrewAI is the initial orchestration engine
- OpenHands is the initial coding worker
- OpenSpec-style constitutions are the source of truth
- GitHub is the primary external work ledger
- Nomad is the intended long-term execution fabric
- services should be modular and independently replaceable

## Suggested Repository Layout

Use a monorepo structure:

- `apps/control`
- `apps/api`
- `apps/brain`
- `apps/executor`
- `packages/domain`
- `packages/db`
- `packages/ui`
- `packages/constitution`
- `infra/docker`
- `infra/nomad`
- `docs`

## Milestones

### Milestone 1: System Skeleton

- monorepo created
- services boot
- database schema created
- health endpoints available
- minimal web shell available

### Milestone 2: Project Registration

- create project
- clone/attach repo
- detect constitution files
- show constitution status in UI

### Milestone 3: Planning Loop

- parse constitution
- generate mission
- generate tasks
- persist and display tasks

### Milestone 4: Execution Loop

- dispatch one implementation task
- execute via OpenHands adapter
- capture logs and results
- persist job state

### Milestone 5: QA and Review

- run QA stage
- run reviewer stage
- mark complete, failed, or blocked

### Milestone 6: End-to-End Demo

- run yeet2 against `forgeyard`
- generate tasks from constitution
- execute one real task
- display full trail in UI

## Acceptance Criteria

The MVP is complete when:

1. yeet2 can start on `10.42.10.101`
2. a repository can be registered as a project
3. constitution files are detected and parsed
4. a mission can be created from the constitution
5. at least 3 tasks can be generated and persisted
6. at least 1 coding task can execute through OpenHands
7. logs and job states are stored and viewable
8. blocker creation and resolution are supported
9. the UI clearly shows project, mission, task, blocker, and job state

## Open Questions

If unclear during implementation, raise blockers for:

- whether repositories are cloned by yeet2 or mounted externally
- how isolated workspaces should be managed on disk
- exact interface boundary between yeet2 and OpenHands
- whether Nomad is required in MVP or deferred behind an abstraction
- whether approval actions are needed in MVP or only blocker resolution

## Related Documents

- `docs/PRODUCT_SPEC.md` defines the yeet2 MVP product and architecture baseline
- `docs/DECISIONS.md` records implementation decisions and any approved stack deviations
