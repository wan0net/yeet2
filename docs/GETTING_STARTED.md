# Getting Started

This guide walks you through registering your first project, configuring autonomy, and getting yeet2 to start executing work on your behalf. Follow the steps in order — each one builds on the last.

---

## Step 1: Register a project

Go to **Projects → Add project** in the Control UI.

Enter a name, a GitHub repo URL, and the default branch you want yeet2 to work against. On save, yeet2 clones the repo and links the project to GitHub issues.

The repo must be accessible to the yeet2 server process. For remote repos, make sure SSH keys or tokens are configured in the environment. For local paths, the path must be readable by the server.

---

## Step 2: Connect GitHub tickets

Open the project detail page. In **GitHub sync**, enable sync and click **Pull GitHub issues**.

The normal intake workflow is:

1. A human creates a GitHub issue describing the desired outcome
2. Yeet imports that issue as a ticket
3. An AI agent picks it up, works in a branch, and opens a PR
4. If the agent needs to split the work, it can emit delegated tickets and Yeet creates new GitHub issues for them
5. Yeet comments progress back on the issue and closes it when complete

Labels can steer execution: `yeet2:planner`, `yeet2:implementer`, `role:coder`, `role:qa`, `p0`, `p1`, `blocked`. If no role label is present, Yeet treats the issue as implementation work.

---

## Step 3: Configure roles

Each project has specialist roles that map to work types:

| Role | Responsibility |
|------|---------------|
| Planner | Triage and decomposition when explicitly requested |
| Architect | Validates scope, design, and approach before implementation |
| Implementer | Writes the code |
| QA | Verifies correctness and runs checks |
| Reviewer | Reviews the final diff before the branch is merged |

Roles are configured on the project detail page under the **Roles** section. Each role can be assigned a different LLM model — use this to balance cost against capability (e.g. a cheaper model for QA, a more capable model for Architect).

At minimum, keep the implementation role enabled for ticket-driven coding work.

---

## Step 4: Set autonomy mode

Autonomy mode controls how much yeet2 does without waiting for you. There are three options:

**Manual**
Nothing runs automatically. You pull GitHub issues and dispatch tasks by hand from the project detail page. Use this if you want full control over every step.

**Supervised**
The autonomy loop pulls GitHub issues on a schedule, but pauses before dispatching work. Recommended for new projects.

**Autonomous**
Full self-driving mode. The loop pulls GitHub issues, dispatches tasks, creates pull requests, and can merge according to project policy.

Set autonomy mode from the project detail page. You can change it at any time; the change takes effect on the next loop cycle.

---

## Step 5: Start from a ticket

With roles configured, create a GitHub issue and pull it into Yeet:

- **Manual mode**: click **Pull GitHub issues**, then dispatch a ticket by hand.
- **Supervised / Autonomous mode**: wait for the next scheduled loop cycle, or click **Run** to force one immediately.

Yeet imports issues into the **GitHub source-of-truth inbox** mission. You can see the imported tickets on the project overview, **Tickets**, and **Missions** pages.

---

## Step 6: Watch the pipeline

The autonomy loop dispatches tasks in stage order:

```
Architect → Implementer → QA → Reviewer
```

Each stage runs as a **job** in an isolated git worktree — stages cannot interfere with each other's working state. While a job is running you can:

- Open **Tickets** first to see running or failed execution work
- Drill into **Jobs** when you need raw logs, artifacts, branches, or worker details
- See the artifact summary (what the agent produced) after each job completes
- Check the stage verdict (pass / fail / blocked) to understand what happened

After all four stages complete successfully, yeet2 creates a pull request. If autonomy mode is set to Autonomous and no human-approval gates are configured, it will also merge automatically.

---

## Step 7: Handle decision and escalation tickets

**Escalation tickets** appear when a task fails twice in a row. The loop stops advancing the affected work item and raises a ticket. Open **Tickets** to:

- Read the failure reason
- Provide resolution guidance and retry
- Dismiss the escalation to let the loop skip the work item and move on

**Decision tickets** appear when:

- Autonomy mode is set to Supervised (the initial plan needs approval)
- Human-approval gates are configured on the project (PRs or merges need sign-off)

Open **Tickets** to approve, reject, resolve, or dismiss pending items. Tickets is the operating surface for every queue item.

---

## Step 8: Monitor ongoing work

Once a project is running, the **Overview** dashboard gives you a top-level view:

- **Current board item** — the most urgent decision, escalation, or active work ticket
- **Agent roster** — each enabled specialist, its project, status, and current task
- **Ticket pressure** — decision, escalation, work, and running-job tickets in one panel
- **Projects to watch** — projects sorted by escalations and active work

The **Workers** page shows the status and heartbeat of executor processes. If workers go stale or offline, queued jobs will not run until a healthy worker is available.

Every decision the autonomy loop makes is recorded as an entry in the project's **Chat** tab. This gives you a full audit trail — what the loop planned, what it dispatched, what it approved or skipped, and why.

---

## Step 9: Work from Tickets

Use the **Tickets** page as the primary operating queue. It replaces the older queue pages with a Paperclip-style command surface:

- **Decision lane** — human-gated decisions that need review
- **Escalation lane** — failed or ambiguous work that needs operator guidance
- **Work lane** — ready, running, blocked, and completed agent work items
- **Execution lane** — active or failed execution traces with logs and artifacts

Tickets are sorted by operational urgency: decision tickets first, then open escalations, failed jobs, running work, ready work, and lower-priority completed or waiting items. Each ticket links back to the owning project so you can inspect the full mission, chat, job output, and PR state.

The normal workflow is:

1. Open **Overview** to see the company-level state.
2. Open **Tickets** to choose the next operator action.
3. Review or resolve the ticket.
4. Jump into the project only when you need deeper context.
