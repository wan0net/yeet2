# yeet2 Beta Spec

## Overview

The beta release builds on the alpha's core autonomy loop by adding GitHub-native project management, expanded operator controls, and operational maturity features.

## GitHub Projects + Issues Integration

### Concept

Every yeet2 mission maps to a GitHub Project board. Every task maps to a GitHub Issue on that board. The pipeline stages (Architect → Implementer → Tester → Coder → QA → Reviewer → Done) become board columns. As the autonomy loop advances tasks through stages, the corresponding issues move between columns automatically.

This gives operators GitHub-native visibility into what the factory is doing, and lets external collaborators track progress without accessing the Control UI.

### Data Flow

```
yeet2 registers project
  → links to GitHub repository
  → operator triggers planning

yeet2 creates mission
  → creates GitHub Project board named "{mission title}"
  → columns: Backlog | Architect | Implementer | Tester | Coder | QA | Review | Done | Blocked

yeet2 creates tasks
  → creates GitHub Issue per task
  → issue title: task title
  → issue body: task description + acceptance criteria
  → issue labels: role (architect, coder, etc.), priority
  → issue added to Project board in Backlog column

autonomy loop dispatches task
  → moves issue to the role's column
  → posts comment: "{agent name} is starting work on this"

agent completes task
  → moves issue to next column
  → posts comment with artifact summary / verdict
  → links PR if created

task blocked
  → moves issue to Blocked column
  → adds "blocked" label
  → posts comment with blocker context and recommendation

task complete
  → moves issue to Done column
  → closes the issue

PR merged
  → posts comment on the task issue confirming merge
  → updates linked Project item status
```

### GitHub API Requirements

- **Projects V2 API** (GraphQL) — for creating/managing project boards and moving items between columns
- **Issues API** (REST) — for creating issues, posting comments, adding labels
- **Pull Requests API** (REST, already implemented) — for linking PRs to issues

### Authentication

Uses the GitHub PAT stored in Settings (already implemented). The PAT needs these scopes:
- `repo` — issues, PRs, branch operations (already required)
- `project` — GitHub Projects V2 read/write

### Configuration

Per-project settings:
- `githubProjectSync: "enabled" | "disabled"` — whether to sync to GitHub Projects
- `githubProjectId: string | null` — the linked GitHub Project ID (auto-created or manually linked)

### API Changes

New functions in `github.ts`:
- `createGitHubProject(token, repo, title)` → creates a Project V2 board with pipeline columns
- `createGitHubProjectItem(token, projectId, issueId)` → adds an issue to a board
- `moveGitHubProjectItem(token, projectId, itemId, columnName)` → moves between columns
- `createGitHubIssueForTask(token, repo, task)` → creates an issue from task data
- `commentOnGitHubIssue(token, repo, issueNumber, body)` → posts agent updates
- `closeGitHubIssue(token, repo, issueNumber)` → marks done
- `linkPullRequestToIssue(token, repo, prNumber, issueNumber)` → connects PR to task issue

### Sync Strategy

**GitHub Issues as source of truth**: yeet2 can pull repository issues into a project inbox mission and map them to internal tickets. Open issues become ready or blocked tickets, closed issues become complete tickets, and labels such as `yeet2:implementer`, `role:qa`, `p1`, or `blocked` guide role, priority, and state.

**Push updates back**: once a Yeet task is linked to a GitHub issue, agent progress, blockers, failures, and completion are posted back to GitHub. GitHub remains the operator-facing ledger; Yeet remains the planner, dispatcher, and worker coordinator.

### UI Changes

- Project detail page: show linked GitHub Project board URL
- Settings: per-project toggle for GitHub sync
- Decision logs: record when issues are created/moved/closed

## Generic Pipeline Platform

### Concept

yeet2's alpha is software-focused, but the core architecture (ordered roles → tasks → dispatch → execute → review) is domain-agnostic. The beta opens this up: any team workflow can be modelled as a pipeline of specialist roles operating on a shared repository of artifacts.

The software development pipeline is just one template. The same engine supports content production, solution architecture, research, compliance review, and any other multi-stage knowledge work.

### Execution Adapters

The executor becomes pluggable. Each project selects an adapter (or multiple adapters, one per role):

| Adapter | Use Case | What It Does |
|---|---|---|
| `openhands` | Software dev | Git worktrees, code changes, PRs (current default) |
| `document` | Content/docs | Read/write markdown and document files in a repo |
| `research` | Research/analysis | Web search, summarise, produce structured reports |
| `canvas` | Design | Generate/modify images and mockups via API integrations |
| `shell` | Ops/infra | Run commands, scripts, deployment pipelines |
| `passthrough` | Generic | Sends the stage brief to the LLM, stores the response as the artifact. No git, no files — pure text in, text out. |

The `passthrough` adapter is the universal fallback. It works for any workflow where the output is a document, decision, analysis, or recommendation. It unlocks non-code use cases with zero additional infrastructure.

Adapter selection is per-project or per-role. A solution architecture project might use `document` for the architect (produces ADRs) and `passthrough` for the reviewer (produces a review verdict).

### Pipeline Templates

Pre-built role sets for common workflows. The operator picks a template at project creation, or builds a custom pipeline:

**Software Development** (current default):
- Architect → Implementer → Tester → Coder → QA → Reviewer

**Content Development:**
- Researcher → Writer → Editor → Fact Checker → Publisher
- *Use case: blog posts, documentation, knowledge bases, technical writing*

**Solution Architecture:**
- Discovery → Solution Architect → Technical Writer → Reviewer → Approver
- *Use case: ADRs, system designs, API contracts, infrastructure specs, RFCs*
- *Outputs: architecture decision records, mermaid diagrams, OpenAPI specs, terraform plans*

**Marketing:**
- Strategist → Copywriter → Designer → Reviewer → Publisher
- *Use case: campaigns, landing pages, email sequences, social content*

**Legal / Compliance:**
- Analyst → Drafter → Reviewer → Compliance Officer → Approver
- *Use case: policy documents, contract review, regulatory filings*

**Data Analysis:**
- Collector → Analyst → Visualiser → Narrator → Reviewer
- *Use case: reports, dashboards, data stories, quarterly reviews*

**Product:**
- PM → Designer → Engineer → QA → Reviewer
- *Use case: feature specs, wireframes, prototypes, acceptance criteria*

**Research:**
- Question Framer → Investigator → Synthesiser → Critic → Publisher
- *Use case: literature reviews, competitive analysis, due diligence*

### Constitution Generalisation

The "constitution" concept (project-level source of truth documents) generalises naturally:

| Software | Generic | Purpose |
|---|---|---|
| VISION.md | PROJECT_BRIEF.md | What are we building and why |
| SPEC.md | REQUIREMENTS.md | What specifically needs to be produced |
| ROADMAP.md | MILESTONES.md | What order to tackle things |
| ARCHITECTURE.md | STANDARDS.md | How work should be structured |
| QUALITY_BAR.md | QUALITY_BAR.md | What "done" looks like |
| DECISIONS.md | DECISIONS.md | Log of key choices made |

The system accepts any of the original or generic filenames. The interview adapts its questions based on the selected pipeline template.

### Artifact Types

Task outputs expand beyond code diffs:

| Type | Description | Storage |
|---|---|---|
| `code` | Source code changes in a git branch (current) | Git worktree + PR |
| `document` | Markdown/text document | Committed to repo |
| `report` | Structured analysis or summary | Stored as job artifact |
| `decision` | ADR or approval record | Committed to repo |
| `diagram` | Mermaid, PlantUML, or image | Committed to repo |
| `review` | Verdict / feedback on prior work | Stored as decision log |

### Pipeline Builder

Operators need a frictionless way to define custom pipelines without editing config files or understanding the internals.

**Approach 1: Visual flow editor (n8n / NiFi style)**

A node-based canvas editor where operators build pipelines visually:

1. **Canvas**: drag stage nodes onto a 2D canvas
2. **Nodes**: each node represents a role/stage — click to configure name, goal, adapter, model, character
3. **Edges**: connect nodes with directional arrows to define the flow order
4. **Branching**: support conditional paths (e.g., if QA fails → loop back to Coder, if passes → proceed to Reviewer)
5. **Loops with exit conditions**: a stage can loop back to an earlier stage with a configurable exit condition (e.g., "Coder → QA → if fails, back to Coder, max 3 iterations then escalate to blocker"). Exit conditions prevent infinite loops:
   - **Max iterations**: hard cap on loop count (default 3)
   - **Verdict-based**: exit when a stage outputs "pass" / meets acceptance criteria
   - **Timeout-based**: exit after N minutes of total loop time
   - **Escalation**: when exit condition triggers, create a blocker instead of continuing
5. **Templates**: start from a pre-built template or blank canvas
6. **Groups**: cluster related stages visually (e.g., "Implementation" group containing Tester + Coder)
7. **Live preview**: as nodes are placed, the pipeline diagram updates in real-time

Each node opens a config panel:
- **Name**: "Writer", "Fact Checker", etc.
- **Goal**: one-line description of what this stage does
- **Adapter**: dropdown (passthrough, document, openhands, research, shell)
- **Model**: dropdown populated from OpenRouter catalog with pricing
- **Character**: auto-assigned from theme or manually set
- **Acceptance criteria**: what "done" means for this stage

The canvas serialises to the same `ProjectRoleDefinition` records used internally — the visual builder is a UI over the existing data model, not a separate system.

Implementation options:
- **Svelte Flow** (svelteflow.dev) — Svelte-native node editor, built for exactly this
- **Xyflow/React Flow** adapted for Svelte — well-established, large ecosystem
- **Custom canvas** — more work but fully aligned with yeet2's design system

The editor stores the pipeline as a list of `ProjectRoleDefinition` records. No new schema needed for the linear case. For branching/conditional flows, add an optional `edges` JSON field on the project.

**Approach 2: Chat-driven pipeline design**

Extend the constitution interview to also design the pipeline:
- "What kind of work is this project about?" → suggests a template
- "Who should be involved?" → maps answers to roles
- "What order should work flow through?" → sets sort order
- Generates both the constitution AND the role definitions

This is the most natural UX — the operator describes what they want, and the system figures out the pipeline. The visual builder serves as the editing surface after the initial interview creates the pipeline.

**Approach 3: YAML/JSON pipeline file**

A `pipeline.yml` in the repo (alongside the constitution):
```yaml
# pipeline.yml
stages:
  - role: researcher
    adapter: research
    model: openrouter/anthropic/claude-sonnet-4.6
    goal: "Find and summarise relevant sources"

  - role: writer
    adapter: document
    model: openrouter/anthropic/claude-opus-4.6
    goal: "Produce a first draft from the research"

  - role: editor
    adapter: passthrough
    goal: "Review for clarity, accuracy, and tone"

  - role: fact-checker
    adapter: research
    model: openrouter/openai/gpt-5.4
    goal: "Verify all claims against primary sources"

  - role: publisher
    adapter: document
    goal: "Format and commit the final version"
```

The system reads this file during constitution inspection, same as VISION.md / SPEC.md. Operators who prefer config-as-code get it; UI users never need to touch it.

**Recommendation**: Build all three. The interview creates the initial pipeline, the visual builder edits it, and `pipeline.yml` is the export/import format. The interview is the primary onboarding path.

### Database Changes

- `Project.pipelineTemplate`: string — which template was used
- `Project.executorAdapter`: string — default adapter for the project
- `ProjectRoleDefinition.executorAdapter`: string | null — per-role adapter override
- `Job.artifactType`: string — what kind of output this job produced

### UI Changes

- Project registration: template picker (software, content, architecture, custom...)
- Project detail: show pipeline as a visual stage diagram
- Role editor: set adapter per role
- Job detail: render artifacts by type (code diff, markdown preview, diagram render)

## Agent Experience & Visualization

### Mission Control Dashboard

A real-time grid view showing every active agent across all projects. One glance tells the operator the state of the entire factory.

Inspired by Cursor 2.0's Mission Control:
- Grid of agent cards, one per active role across all projects
- Each card shows: character name, role, project, current task, status (working / idle / blocked)
- Cards pulse when actively executing
- Blocked cards show red with blocker summary
- Click any card to jump to that project's detail page
- Replaces the current bare Overview page

This becomes the factory's primary dashboard — the first thing operators see.

### Live Pipeline Graph

The static pipeline view (added in alpha) becomes live:
- **Active node pulses** with an animated border while the agent is working
- **Completed nodes** show a checkmark and green fill
- **Blocked nodes** flash red
- **Progress indicator** on the active node shows elapsed time
- **Edges animate** when a handoff happens (stage complete → next stage starts)
- **Tooltip on hover** shows the latest artifact summary or working message

Implementation: the project detail page polls for task status updates (or uses SSE/websocket in a later pass) and updates the pipeline nodes reactively.

### Mid-Task Chat Steering

Operators can talk to agents while they're working, not just before dispatch.

Inspired by OpenHands and Devin:
- While a job is running, the chatroom shows a "working" indicator for the active agent
- Operator types a message → it's sent to the executor as an interrupt/guidance injection
- The agent incorporates the guidance into its current work
- Examples: "skip the migration for now", "focus on the API routes first", "use postgres not sqlite"

**Implementation:**
- New API endpoint: `POST /projects/:id/jobs/:jobId/steer` with `{ guidance: "..." }`
- Executor appends the guidance to the active OpenHands session (or the passthrough prompt)
- Decision log records the steering event
- UI shows the guidance message in the chatroom with a "steering" badge

This is the single biggest UX improvement for power users — it turns fire-and-forget into collaborative development.

### Chunked Progress Summaries

Instead of raw logs, agents post narrative progress updates during execution.

Inspired by Devin:
- Every N seconds (or at key milestones), the executor posts a summary: "I've read the spec and identified 3 files to modify. Starting with `api/routes.ts`..."
- Summaries appear in the chatroom as agent messages
- They're richer than the current artifact summary (which only comes at completion)
- Implementation: the executor periodically parses its JSONL output and posts intermediate summaries via the heartbeat/API callback

### Spatial Agent Visualization (Office View)

A visual mode where agents are shown as characters in a themed environment.

Inspired by Stanford Smallville and ChatDev:
- A 2D scene matching the agent theme (Star Trek bridge, Firefly cargo bay, LOTR war table, The Office... office)
- Each agent character has a position in the scene
- **Working**: character animates at their station, speech bubble shows current task
- **Idle**: character sits at their desk, muted colors
- **Blocked**: red exclamation mark above their head, speech bubble shows blocker
- **Handoff**: animated path between characters as work passes from one to the next
- Click a character → opens their task detail / chat

**Theme environments:**

| Theme | Environment |
|---|---|
| Star Trek TNG | Enterprise bridge with stations |
| Star Wars | Rebel base war room |
| Stargate SG-1 | SGC briefing room |
| LOTR | Council of Elrond |
| Firefly | Serenity cargo bay |
| The Office | Dunder Mifflin office floor |
| Silicon Valley | Hacker hostel garage |
| Hitchhiker's | Heart of Gold bridge |
| Mythology | Mount Olympus |
| Dune | Sietch war room |
| Matrix | Nebuchadnezzar hovercraft |
| Red Dwarf | Starbug cockpit |

**Implementation:**
- Each theme ships a background SVG/image and character position coordinates
- Character sprites are simple SVG avatars (or pixel art for the retro feel)
- Status is overlaid with CSS animations
- Toggle between Pipeline View (graph) and Office View (spatial) on the project page
- Mobile: falls back to pipeline view

This is the "delight" feature — it makes the factory feel alive and gives the agent themes real visual presence. It's also the most shareable/demo-friendly feature.

### Execution Trace Visualization

A detailed step-by-step view of what an agent did during a task.

Inspired by LangGraph Studio:
- Each job gets a timeline view showing: tool calls, file reads, file writes, test runs, errors
- Nodes in the timeline are clickable — expand to see the full input/output
- Errors are highlighted in red
- The timeline replaces the current raw log viewer for debugging
- Implementation: parse the OpenHands JSONL output into structured events and render as a visual timeline

## Other Beta Features

### Custom Roles

Operators can create, rename, and reorder roles beyond the 8 defaults. The planning pipeline becomes fully dynamic — roles execute in sort-order, and the Brain generates tasks only for enabled roles.

### Role Editor in Control UI

Project detail page gets a role management section:
- Add/remove roles
- Drag to reorder
- Set model per role
- Enable/disable individual roles
- Set character name per role

### Webhook Support

- `POST /webhooks/github` — receive GitHub webhook events for PR merges, issue comments, etc.
- Enables two-way sync when an operator resolves a blocker on GitHub directly

### Improved Constitution Interview

- Support follow-up questions when answers are too vague
- Generate ARCHITECTURE.md and QUALITY_BAR.md in addition to the three required files
- Allow re-running the interview to update existing files

### Operational Maturity

- **Audit log**: searchable history of every autonomy decision, dispatch, and merge
- **Cost tracking**: per-project and per-role LLM token spend from OpenRouter usage data
- **Worker pool**: support multiple executor instances with load balancing
- **Backup/restore**: one-command database backup and restore
- **Upgrade path**: `prisma migrate deploy` instead of `prisma db push`

## Timeline

The beta builds incrementally on the alpha. The GitHub Projects integration is the headline feature and should be built first. Custom roles and the role editor follow. Operational maturity features are addressed continuously.

## Agent Skills & Plugin Ecosystem

### Concept

The Agent Skills standard (SKILL.md) is now cross-platform (Claude Code, OpenAI Codex). yeet2 should support loading agent skills that extend what roles can do — giving agents new tools and capabilities without changing the core platform.

### How It Works

- Each skill is a SKILL.md file with instructions + optional scripts and templates
- Skills are loaded per-role or per-project
- A role configured with a "web-search" skill gains the ability to search the web
- A role configured with a "screenshot" skill can capture visual output
- Skills are discoverable via a built-in catalog or imported from external marketplaces

### Examples

| Skill | What It Adds | Use Cases |
|---|---|---|
| `web-search` | Search the web and cite sources | Research roles, fact-checking |
| `screenshot` | Capture screenshots of web pages or UIs | Visual review, QA verification |
| `file-manager` | Read/write/organize files beyond git | Content workflows, document management |
| `api-caller` | Make HTTP requests to external APIs | Integration testing, data collection |
| `diagram-generator` | Generate mermaid/PlantUML diagrams | Architecture, documentation |
| `image-generator` | Generate images via DALL-E/Midjourney APIs | Design roles, visual content |
| `slack-notifier` | Post messages to Slack channels | Status updates, escalations |
| `database-query` | Run read-only SQL queries | Data analysis, QA verification |

### Plugin Packaging

Following the emerging standard: a plugin bundles one or more skills with optional MCP server configuration, so a single install adds multiple capabilities.

## Observability & Tracing

### Langfuse Integration

Integrate Langfuse (open-source, MIT, self-hostable) for full LLM observability:

- **Trace every LLM call** — see exactly what prompt was sent, what response came back, latency, token count, cost
- **Multi-turn conversation tracking** — follow an agent's full reasoning chain across tool calls
- **Per-project and per-role cost dashboards** — answer "how much did this mission cost?" and "which role spends the most?"
- **Evaluation and quality scoring** — rate agent outputs to track quality over time
- **Self-hosted** — runs alongside yeet2 in Docker, no data leaves the operator's infrastructure

This replaces the manual audit log and cost tracking features with a proper observability platform.

### Implementation

- Add Langfuse as an optional Docker service in the compose files
- Brain and Executor instrument LLM calls with the Langfuse SDK
- Control UI links to the Langfuse dashboard for trace exploration
- Configuration via `LANGFUSE_HOST`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`

## External Trigger Sources

### Concept

Work can be triggered from outside the Control UI — from GitHub, Slack, or other external systems. This lets operators kick off tasks without opening the yeet2 web app.

### Trigger Sources

| Source | How It Works |
|---|---|
| **GitHub Issue** | Label an issue with `yeet2:plan` → autonomy loop picks it up and plans a mission |
| **GitHub Comment** | Comment `@yeet2 implement this` on a PR → dispatches a task |
| **Slack** | Send a message to a yeet2 channel → triggers planning or dispatch |
| **Webhook** | POST to `/api/trigger` with project ID and intent → kicks off the loop |
| **CLI** | `yeet2 plan <project>` from the command line |
| **Cron** | Scheduled autonomy runs beyond the loop interval |

### Implementation

- Webhook receiver in the API: `POST /webhooks/github`, `POST /webhooks/slack`
- GitHub App installation for richer integration (vs. PAT-only)
- Slack App with slash commands (`/yeet2 plan forgeyard`)
- CLI tool that calls the API directly

## Agent Verification & Demos

### Concept

Agents produce verification artifacts — screenshots, test results, demo recordings — that prove their work is correct before handoff.

Inspired by Cursor 3's cloud agent demos:

- **Visual roles**: capture a screenshot of the rendered UI after changes
- **QA roles**: include test output (pass/fail counts, coverage delta)
- **Coder roles**: include a diff summary and build status
- **All roles**: produce a one-paragraph "handoff note" explaining what was done and what to check

### Implementation

- Verification artifacts are stored alongside job logs
- The pipeline view shows a verification badge on completed nodes
- Click the badge → see the screenshot, test output, or handoff note
- The reviewer role's acceptance criteria include checking verification artifacts

## Non-Goals for Beta

- Multi-tenant / multi-user auth (deferred to GA)
- Nomad distributed execution (deferred)
- Container-level sandboxing (ASRT covers the alpha; container isolation deferred)
- Real-time websocket updates in the UI (polling is sufficient for beta)
