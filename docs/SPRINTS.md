# yeet2 Beta Sprint Plan

Each sprint is ~1 week. Scope is sized for one focused developer. Test cases are written alongside each feature — not after.

---

## Sprint 1 — Pipeline Foundation ✓ Done

**Theme:** Make the pipeline generic and the factory visible.

**Delivered:**
- Passthrough adapter (pure text-in, text-out for non-code workflows)
- Pipeline templates (software, content, architecture, research, marketing, legal)
- Mission Control dashboard (grid of active agent cards)
- Template picker at project creation

**Test cases (written):**
- Passthrough job produces artifact stored as job output
- Software template creates 6 roles in correct sort order
- Mission Control renders all active agents across projects
- Template picker defaults to "software"; selection persists on form error

---

## Sprint 2 — Constitution & Roles

**Theme:** Complete the onboarding experience. Operators register a project, complete the interview, and get a fully configured pipeline without touching config files.

**Features:**
1. **Interview template detection** — step 0 asks project type; LLM classifies; roles auto-updated to match
2. **`data` and `product` pipeline templates**
3. **Role Editor in Control UI** — add, remove, reorder, enable/disable roles; set model per role; set character name
4. **GitHub OAuth login** — replace PAT-only auth with OAuth flow; token scoped to `repo` + `project`
5. **Interview re-run** — allow re-running the interview to update existing constitution files; interview detects existing files and skips questions already answered

**Test cases:**
- Interview step 0 with "I'm building a blog publishing platform" → suggests `content` template → roles updated to Researcher/Writer/Editor/Fact Checker/Publisher
- Interview step 0 with "data pipeline analysis dashboard" → suggests `data` template
- LLM unavailable → keyword fallback correctly classifies common answers
- `custom` returned when no keywords match
- Role editor: add new role → appears in dispatch queue; remove role → tasks no longer generated for it
- Role reorder: drag architect to position 2 → sort order persisted; autonomy loop respects new order
- Disable a role → planner skips it; re-enable → tasks generated again
- Model override per role → effectiveModel uses override, not recommended default
- GitHub OAuth: token stored in Settings; PAT input still works as fallback
- Interview re-run on project with existing VISION.md → skips vision questions, only asks missing files

---

## Sprint 3 — GitHub Native

**Theme:** Every mission is visible as a GitHub Project board. Every task is a GitHub Issue. The factory is transparent to any GitHub collaborator.

**Features:**
1. **GitHub Projects V2 board creation** — created when mission is created; columns: Backlog / per-role / Blocked / Done
2. **GitHub Issue per task** — created in Backlog with title, description, acceptance criteria, and role label
3. **Issue column sync** — autonomy loop moves issue to role column on dispatch; to Done on completion; to Blocked on blocker
4. **Issue comments** — agent posts comment on dispatch start, task complete (with artifact summary), and blocker creation
5. **PR-to-issue linking** — PR created by coder role linked to task issue
6. **Webhook receiver** — `POST /webhooks/github` receives push/PR/issue events; HMAC signature verified
7. **Per-project GitHub sync toggle** — enable/disable per project in Settings

**Test cases:**
- Mission created → GitHub Project board exists with correct columns
- Task created → GitHub Issue created in Backlog column with correct labels
- Task dispatched to architect → issue moved to Architect column; comment posted
- Task completed → issue moved to Done; closed; artifact summary in comment
- Blocker created → issue moved to Blocked column; "blocked" label added
- PR created for coder task → PR description includes `Closes #<issue>` reference
- Webhook receives `push` event → signature verified; event recorded in decision log
- Invalid webhook signature → 401 returned; event ignored
- GitHub sync disabled → no API calls made; no board created
- PAT missing `project` scope → clear error surfaced in UI; sync disabled gracefully

---

## Sprint 4 — Live Agent Experience

**Theme:** The factory feels alive. Operators can see what agents are doing in real time and steer them mid-task.

**Features:**
1. **Live pipeline graph** — active node pulses; completed nodes show checkmark; blocked nodes flash red; edges animate on handoff
2. **Mid-task chat steering** — `POST /projects/:id/jobs/:jobId/steer` sends guidance to running executor; recorded in decision log; shown in chatroom with steering badge
3. **Chunked progress summaries** — executor posts narrative updates every N seconds during job execution; appear as agent messages in chatroom
4. **Execution trace viewer** — per-job timeline of tool calls, file reads/writes, test runs, errors; replaces raw log viewer

**Test cases:**
- Active task role's node has `pulsing` CSS class; completed nodes have `done` class; blocked nodes have `blocked` class
- Node tooltip on hover shows latest artifact summary or working message
- Edge animates (CSS transition) when task moves from role N to role N+1
- Steering endpoint with valid jobId → guidance appended to executor; decision log entry with `kind: steer`
- Steering on completed job → 409 returned
- Progress summary posted during long job → appears in chatroom with agent actor and `progress` badge
- Execution trace: JSONL parsed into events; file write event shows filename and line count; error event highlighted red
- Trace: clicking tool-call node expands to show full input/output

---

## Sprint 5 — Observability & Operational Maturity

**Theme:** Operators can answer "how much did this cost?", "what decision was made here?", and "is the system healthy?" without digging through logs.

**Features:**
1. **Langfuse integration** — Brain and Executor instrument all LLM calls; Docker service added to compose
2. **Cost tracking** — per-project and per-role token spend surfaced in Control UI; pulled from OpenRouter usage headers or Langfuse
3. **Audit log page** — searchable, filterable history of all autonomy decisions, dispatches, and merges in Control UI
4. **`prisma migrate deploy` upgrade path** — replace `db push` with proper migration workflow; add migration on schema change
5. **Backup/restore** — `pnpm db:backup` and `pnpm db:restore` scripts; SQLite dump or Postgres pg_dump depending on provider

**Test cases:**
- Langfuse configured → every LLM call in Brain produces a Langfuse trace with model, tokens, latency
- Langfuse not configured → system operates normally; no errors
- Cost page shows per-project total; drilldown shows per-role breakdown; values match Langfuse data
- Audit log: filter by project → only shows entries for that project
- Audit log: filter by kind `dispatch` → only dispatch entries
- Audit log: search by summary text → matching entries returned
- `pnpm db:backup` produces a file; `pnpm db:restore <file>` restores it; project list matches
- Prisma migration: add a field to schema → `migrate dev` generates migration; `migrate deploy` applies cleanly

---

## Sprint 6 — Verification & Spatial View

**Theme:** Agents prove their work before handoff. The factory has a visual presence that's shareable and demo-friendly.

**Features:**
1. **Agent verification artifacts** — coder attaches diff summary and build status; QA attaches test output; all roles produce handoff note; pipeline node shows verification badge
2. **Spatial / Office view** — 2D scene per theme; characters animate at their station; speech bubbles show current task; handoff animation between characters; toggle between pipeline view and office view
3. **Execution trace polish** — coverage delta shown on QA nodes; screenshot artifact rendered inline for visual roles

**Test cases:**
- Coder job completes → artifact includes `diffSummary` and `buildStatus` fields
- QA job completes → artifact includes `testOutput` with pass/fail counts
- Any completed job → artifact includes `handoffNote` (non-empty string)
- Pipeline node with verification artifact shows badge icon; click opens modal with artifact content
- Office view: toggle from pipeline view → scene renders with correct theme background
- Star Trek theme: characters positioned at correct bridge stations
- Active task: character at station animates (CSS keyframe); speech bubble shows task title
- Blocked task: red exclamation above character head
- Handoff: animated path SVG between two character positions plays on task state change
- Mobile viewport: office view hidden; pipeline view shown
- Screenshot artifact on visual role: rendered as `<img>` in job detail, not raw base64

---

## Sprint 7 — External Triggers & Skills

**Theme:** Work can arrive from anywhere. Roles can be extended with new capabilities without touching the platform.

**Features:**
1. **GitHub external triggers** — label issue `yeet2:plan` → planning triggered; comment `@yeet2 implement this` on PR → task dispatched
2. **Webhook trigger endpoint** — `POST /api/trigger` with `{ projectId, intent }` kicks off planning or dispatch
3. **Slack trigger** — Slack App with `/yeet2 plan <project>` slash command; posts progress updates to channel
4. **CLI trigger** — `yeet2 plan <project>` and `yeet2 dispatch <project>` commands that call the API
5. **Agent skills** — SKILL.md loading per-role; `web-search` and `file-manager` skills shipped as built-ins; skill catalog page in Control UI

**Test cases:**
- Issue labelled `yeet2:plan` → autonomy loop triggered within one poll interval; mission created
- `@yeet2 implement this` comment on PR → task dispatched for the PR's associated issue
- `POST /api/trigger` with valid projectId and `intent: plan` → planning job queued; 202 returned
- `POST /api/trigger` with unknown projectId → 404
- `POST /api/trigger` without auth → 401
- Slack `/yeet2 plan forgeyard` → planning triggered; Slack confirms with ephemeral message
- `yeet2 plan forgeyard` CLI → exits 0; mission visible in Control UI
- Role with `web-search` skill → system prompt includes skill instructions; tool available to executor
- Skill catalog page lists built-in skills; clicking a skill shows description and usage
- Assigning skill to role → saved in role definition; present in next dispatch brief

---

## Test Infrastructure (Ongoing)

These apply across all sprints and are set up in Sprint 2:

- **Unit tests** (`vitest`) — pure functions in `packages/domain`, interview logic in Brain (pytest), role definition builders
- **Integration tests** — API route tests against a real SQLite test database using `prisma migrate reset`; Brain endpoint tests with mocked LLM responses
- **E2E tests** (`playwright`) — critical happy paths: register project → run interview → start mission → dispatch task → complete task
- **GitHub Actions CI** — runs unit + integration tests on every PR; E2E on merge to main
- **Test fixtures** — seed script (`pnpm db:seed:test`) that creates one project per template type with pre-loaded constitution files
