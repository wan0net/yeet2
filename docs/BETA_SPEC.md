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

**Push-only by default**: yeet2 pushes state changes to GitHub. It does not read back from GitHub to determine task state. The yeet2 database remains the source of truth.

**Optional pull-sync (future)**: Operators could move issues on the GitHub board, and yeet2 could poll/webhook to detect external state changes. This is deferred to a later release.

### UI Changes

- Project detail page: show linked GitHub Project board URL
- Settings: per-project toggle for GitHub sync
- Decision logs: record when issues are created/moved/closed

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

## Non-Goals for Beta

- Multi-tenant / multi-user auth (deferred to GA)
- Nomad distributed execution (deferred)
- Container-level sandboxing (ASRT covers the alpha; container isolation deferred)
- Real-time websocket updates in the UI (polling is sufficient for beta)
