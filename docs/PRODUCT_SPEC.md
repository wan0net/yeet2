# yeet2 MVP Product Spec

## Summary

yeet2 is a self-hosted autonomous software-team platform.

It manages software projects from GitHub issues: humans create tickets, Yeet imports them, dispatches specialist agents to execute them, pushes code through PRs, and escalates only when needed.

yeet2 is a new project. It may borrow ideas from Yeet, especially around distributed execution and machine-aware job routing, but it should be implemented as a fresh system with clear internal abstractions.

## Product Intent

yeet2 exists to let an operator define a software project once, then have an autonomous system continue planning, implementing, testing, reviewing, and refining that project over time.

The operator should not need to micromanage day-to-day work.

The system should:

- treat GitHub issues as the source-of-truth backlog
- use project reference docs to ground implementation choices
- assign work to specialist agents
- execute jobs on appropriate workers
- persist all state and decisions
- request human input only when ambiguity or risk requires it

## Primary Use Case

A technical operator runs yeet2 on a self-hosted machine and attaches one or more software repositories.

For each attached project, yeet2 should:

1. pull human-created GitHub issues
2. map issue labels to role, priority, and state
3. assign tickets to specialist agents
4. execute implementation and validation jobs
5. open PRs, produce artifacts, logs, and blockers
6. comment progress back to GitHub and close completed issues

## Example Project

Use an internal example project named `forgeyard` for dogfooding.

`forgeyard` is the internal dogfood expression of yeet2 itself, not a separate adjacent product track. It serves as the control plane for autonomous software teams and project missions.

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

Use **OpenSpec** as optional reference documentation for durable project intent and spec-driven development.

OpenSpec is responsible for:

- grounding ticket execution in durable project documents
- keeping implementation aligned to explicit project intent rather than ephemeral prompts

In yeet2, OpenSpec-style project files are reference context. GitHub issues are the source of truth for work.

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
- issues as durable work items and the source-of-truth backlog
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

The intended visual direction for yeet2 Control is full alignment with the `link42.app` theme system, typography, spacing, and header language. Functional progress is allowed to continue ahead of complete visual convergence, but the target state is not merely inspiration from link42; it is deliberate UI alignment.

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
- GitHub issues must remain the source of truth for work
- project reference docs must remain durable context for agents

## Implementation Defaults

### Core Languages

- TypeScript for web UI, API, and most control-plane services
- Python for agent orchestration and OpenHands integration where that is the path of least resistance

### Monorepo and Package Management

- pnpm workspace for TypeScript packages and apps
- one repository containing all MVP services

### Frontend

- SvelteKit for `apps/control`
- Svelte for UI
- link42-aligned tokens, CSS, and component patterns for the control surface
- auxiliary component libraries may be used only when they do not fight the link42 design system direction

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
- when auth is enabled, prefer **better-auth** or a strong SvelteKit-native equivalent that fits the control app and API integration cleanly
- auth boundaries must still be designed so a stronger auth model can be added later
- session, identity, and future role/approval boundaries should be modeled so the chosen auth system can expand from local auth toward stronger operator authentication without a major rewrite

### Ease Of Use Defaults

- yeet2 should be easy to drive in its normal mode, with advanced controls available only when the operator wants them
- the system should choose recommended defaults whenever a sensible default exists
- model selection should be role-aware by default, so planner, architect, implementer, QA, reviewer, and visual staff each get a recommended model without manual tuning
- custom per-staff model overrides are an advanced control, not the required path

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

- Frontend: SvelteKit + Svelte + link42-aligned CSS
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

The Brain should treat these files as durable project context. GitHub issues remain the source of truth for work intake and completion state.

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

Projects are not limited to exactly one staff member per role.

yeet2 should support multiple configured staff members for the same functional role, such as multiple planners, multiple implementers, or multiple reviewers.

This is important for:

- assigning different models to the same type of work
- comparing or rotating outputs across multiple agents in the same lane
- scaling a role horizontally when a project needs more throughput

The control UI and Brain configuration model should therefore treat role definitions as a list of staff members, not a fixed singleton map keyed only by role type.

Each configured staff member should still declare a primary role, but there may be more than one staff member with that same primary role.

### Planner

Responsibilities:

- read project reference docs
- triage and refine GitHub issues when requested
- prioritize work
- keep tickets aligned to project reference docs and current repo state
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
3. A human creates a GitHub issue describing the desired outcome.
4. yeet2 imports GitHub issues into the source-of-truth inbox mission.
5. Labels map each issue to role, priority, and state.
6. An implementation-capable agent dispatches the first coding ticket through the execution adapter.
7. OpenHands, Codex, Claude, or another harness executes the ticket in an isolated workspace or branch.
8. If an agent needs to break down work, it emits delegated ticket suggestions and Yeet creates new linked GitHub issues.
9. QA or reviewer stages run when configured by role labels or project policy.
10. If blocked, a blocker is created and surfaced in UI and GitHub.
11. Yeet opens or updates a PR, comments progress back to GitHub, and closes completed issues.
12. All mission, task, job, PR, and issue state remain visible in the UI.

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
- cost analysis for configured staff/models and the current project operating mix
- team chat/activity thread combining agent workflow chatter and operator interjections

### Agent View

Shows:

- specialist agent role
- stable staff key and a separate visual display name
- current or last-known task
- agent status such as running, idle, blocked, or completed
- recent output or activity summary
- project-level grouping so the operator can quickly see the crew at work
- support for multiple staff members within the same functional role
- model selection and associated cost visibility for each configured staff member

This view should feel fun and alive, but still fit the internal tool tone of yeet2.

### Team Chat View

Shows:

- workflow messages from planner, architect, implementer, QA, reviewer, visual, and system actors
- live in-progress updates from agents about what they are currently working on, investigating, or validating
- handoff-style messages between agents so the thread feels like a living software team rather than a silent pipeline
- explicit baton-pass moments where one agent can tag the next agent or staff member to indicate "your turn"
- operator messages in the same thread
- `@reply` and mention support so humans can steer active work in context
- `@role` and `@staff-member` addressing so both agents and humans can direct the next turn clearly
- reply threading or reply references sufficient to preserve conversation context
- durable message history in Postgres rather than ephemeral prompt state or repo files
- targeted messages should be able to drive action selection or agent attention when addressed to a specific role or staff member
- broadcast messages may be visible to the whole project, but they should not automatically cause every agent to respond or change behavior

The intended interaction model is that team chat acts as the handoff surface between agents.
For example, an implementer should be able to summarize work completed, tag QA or Reviewer, and leave the next actor with clear context, artifacts, and expectations.
Operators should be able to interject into that same handoff stream without breaking the workflow trail.
The same thread should also support "working chat" while an agent is active, so the operator can see short progress notes, discoveries, uncertainties, and requests for input before the handoff happens.
In practice, yeet2 should support both in-progress working messages and clearer final handoff messages within one durable conversation trail.
Only the explicitly addressed role, staff member, or reply target should treat a targeted message as actionable by default.

### Mission Detail Page

Shows:

- mission objective
- task list
- task status
- assigned role
- recent job runs
- result summaries

### Tickets Page

Shows:

- ticket title
- ticket lane
- project
- related work item
- context
- options
- recommendation
- decision or resolution state

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
- GitHub issues are the source of truth for work
- OpenSpec-style docs are reference context
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

### Milestone 3: Ticket Sync Loop

- pull GitHub issues
- create source-of-truth inbox mission
- map labels to role, priority, and status
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
- import a GitHub issue as a ticket
- execute one real task
- display full trail in UI

## Acceptance Criteria

The MVP is complete when:

1. yeet2 can start on `10.42.10.101`
2. a repository can be registered as a project
3. GitHub sync can import repository issues
4. a source-of-truth inbox mission can be created from GitHub issues
5. imported tickets can be persisted with issue numbers
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
