# Getting Started

This guide walks you through registering your first project, configuring autonomy, and getting yeet2 to start executing work on your behalf. Follow the steps in order — each one builds on the last.

---

## Step 1: Register a project

Go to **Projects → Add project** in the Control UI.

Enter a name, a repo URL (or an absolute local path), and the default branch you want yeet2 to work against. On save, yeet2 clones the repo and scans the `docs/` directory for constitution files.

The repo must be accessible to the yeet2 server process. For remote repos, make sure SSH keys or tokens are configured in the environment. For local paths, the path must be readable by the server.

---

## Step 2: Check constitution status

Open the project detail page. Find the **Constitution** section and look at the file pills.

- **Green pill** — the file was detected in `docs/`
- **Grey pill** — the file is missing

**Required files** (planning will not start without these):

| File | Purpose |
|------|---------|
| `VISION.md` | What the project is trying to achieve and why |
| `SPEC.md` | Feature and behaviour requirements |
| `ROADMAP.md` | Prioritised list of work items |

**Recommended files** (improve plan quality significantly):

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | System structure and key design decisions |
| `DECISIONS.md` | ADR log — why certain approaches were chosen |
| `QUALITY_BAR.md` | Acceptance criteria and non-functional requirements |

Use the built-in **constitution editor** in the project detail page to create or edit any of these files directly from the UI. Agents read these documents as their primary context when forming plans.

---

## Step 3: Configure roles

Each project has five specialist roles that map to stages in the execution pipeline:

| Role | Responsibility |
|------|---------------|
| Planner | Generates the mission and task breakdown |
| Architect | Validates scope, design, and approach before implementation |
| Implementer | Writes the code |
| QA | Verifies correctness and runs checks |
| Reviewer | Reviews the final diff before the branch is merged |

Roles are configured on the project detail page under the **Roles** section. Each role can be assigned a different LLM model — use this to balance cost against capability (e.g. a cheaper model for QA, a more capable model for Architect).

All five core roles must be enabled. If any role is disabled, planning will refuse to start.

---

## Step 4: Set autonomy mode

Autonomy mode controls how much yeet2 does without waiting for you. There are three options:

**Manual**
Nothing runs automatically. You trigger planning and task dispatch by hand from the project detail page. Use this if you want full control over every step.

**Supervised**
The autonomy loop plans missions automatically on a schedule, but pauses before dispatching any tasks. You review the generated plan in the Approvals page and approve it before execution begins. Recommended for new projects.

**Autonomous**
Full self-driving mode. The loop plans, dispatches tasks, creates pull requests, and merges — all without human intervention. Use this only after you trust the constitution files and role configuration.

Set autonomy mode from the project detail page. You can change it at any time; the change takes effect on the next loop cycle.

---

## Step 5: Trigger the first plan

With roles configured and constitution files in place, trigger a plan:

- **Manual mode**: click **Plan** on the project detail page.
- **Supervised / Autonomous mode**: wait for the next scheduled loop cycle, or click **Plan** to force one immediately.

yeet2 reads the constitution files and generates a **mission** — a structured description of what needs to be done. The mission is then broken into tasks, one per role:

1. Architect task: validate scope and design approach
2. Implementer task: write the code
3. QA task: verify and test
4. Reviewer task: review the final diff

You can see the generated mission and its tasks on the **Missions** page.

---

## Step 6: Watch the pipeline

The autonomy loop dispatches tasks in stage order:

```
Architect → Implementer → QA → Reviewer
```

Each stage runs as a **job** in an isolated git worktree — stages cannot interfere with each other's working state. While a job is running you can:

- Watch live log output on the **Jobs** page
- See the artifact summary (what the agent produced) after each job completes
- Check the stage verdict (pass / fail / blocked) to understand what happened

After all four stages complete successfully, yeet2 creates a pull request. If autonomy mode is set to Autonomous and no human-approval gates are configured, it will also merge automatically.

---

## Step 7: Handle blockers and approvals

**Blockers** occur when a task fails twice in a row. The loop stops advancing the affected task and raises a blocker entry. Go to the **Blockers** page to:

- Read the failure reason
- Provide resolution guidance and retry
- Dismiss the blocker to let the loop skip the task and move on

**Approvals** are required when:

- Autonomy mode is set to Supervised (the initial plan needs approval)
- Human-approval gates are configured on the project (PRs or merges need sign-off)

Go to the **Approvals** page to review and approve or reject pending items.

---

## Step 8: Monitor ongoing work

Once a project is running, the **Overview** dashboard gives you a top-level view:

- **Current board item** — the most urgent approval, blocker, or active task
- **Agent roster** — each enabled specialist, its project, status, and current task
- **Ticket pressure** — approvals, blockers, ready tasks, and running jobs in one panel
- **Projects to watch** — projects sorted by blockers and active work

The **Workers** page shows the status and heartbeat of executor processes. If workers go stale or offline, queued jobs will not run until a healthy worker is available.

Every decision the autonomy loop makes is recorded as an entry in the project's **Chat** tab. This gives you a full audit trail — what the loop planned, what it dispatched, what it approved or skipped, and why.

---

## Step 9: Work from Tickets

Use the **Tickets** page as the primary operating queue. It combines the older queue pages into a Paperclip-style command surface:

- **Approvals** — human-gated decisions that need review
- **Blockers** — failed or ambiguous work that needs operator guidance
- **Tasks** — ready, running, blocked, and completed agent work items
- **Jobs** — active or failed execution traces with logs and artifacts

Tickets are sorted by operational urgency: approvals first, then open blockers, failed jobs, running work, ready tasks, and lower-priority completed or waiting items. Each ticket links back to the owning project so you can inspect the full mission, chat, job output, and PR state.

The legacy **Tasks**, **Blockers**, **Approvals**, and **Jobs** pages still exist for focused triage, but the normal workflow is:

1. Open **Overview** to see the company-level state.
2. Open **Tickets** to choose the next operator action.
3. Review or resolve the ticket.
4. Jump into the project only when you need deeper context.
