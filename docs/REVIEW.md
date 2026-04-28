# Review: Optimisation, Security, And Workflow

Review date: 2026-04-28.

## Summary

yeet2 is close to a runnable single-host autonomous software engineering stack. The strongest path is Docker Compose with repo URL registration, Tickets as the only operator queue, and a coding harness selected by `YEET2_EXECUTOR_MODE`.

This pass made Codex CLI and Claude Code usable as coding harnesses beside OpenHands, and documented the go-to-woah operator path.

## What Looks Good

- **Container boundary** — API, Control, Brain, Executor, Postgres, and Redis have clear deploy/release compose definitions.
- **Executor isolation** — jobs run in isolated Git worktrees with logs and artifact summaries.
- **Operator model** — Tickets now centralizes decision, escalation, work, and execution lanes.
- **Service auth hooks** — API, Brain, Executor, and Hermes bearer tokens exist and are wired through compose.
- **CI/CD** — build, test, docs, security, and image publishing are already present.

## Security Findings

| Priority | Finding | Recommendation |
|---|---|---|
| High | Executor can run agent-written shell/code in a repo checkout. | Use `YEET2_EXECUTOR_SANDBOX_MODE=asrt` or an equivalent container/VM sandbox before production autonomy. |
| High | Blank bearer tokens disable internal service auth. | Generate non-empty `YEET2_API_BEARER_TOKEN`, `YEET2_BRAIN_BEARER_TOKEN`, and `YEET2_EXECUTOR_BEARER_TOKEN`. |
| High | Coding harness CLIs may read user config if run on a shared host. | Prefer the Docker executor or set isolated `CODEX_HOME` / `CLAUDE_CONFIG_DIR`; Claude mode uses `--bare` by default. |
| Medium | No global job timeout is dangerous for long-running harnesses. | Keep `YEET2_HARNESS_TIMEOUT_SECONDS` or harness-specific timeout env vars set. |
| Medium | Docker socket is not mounted, which is good; keep it that way. | Avoid mounting `/var/run/docker.sock` into Executor unless an external sandbox owns the risk. |
| Medium | Local-path project registration can expose host paths if mounted broadly. | Prefer repo URL registration in Docker; if using local paths, mount only the required project path into API and Executor. |

## Optimisation Findings

| Area | Finding | Recommendation |
|---|---|---|
| Image build | Optional Codex/Claude CLIs add Node/npm install cost. | Keep `YEET2_INSTALL_CODE_HARNESSES=false` for OpenHands images; enable only for harness images. |
| Runtime | Executor is synchronous per HTTP request. | Keep job timeouts tight; future work should make executor job execution fully async with persistent job state. |
| Worktrees | Worktrees can accumulate after failures. | Use `YEET2_EXECUTOR_WORKTREE_CLEANUP=always` on constrained hosts, or scheduled cleanup for failed jobs. |
| Planning | CrewAI planning can be expensive/slow. | Start with Supervised mode and a cheaper planner model until project constitution is stable. |
| Logs | Harness JSON streams are stored as raw logs. | Add structured parsing per harness for richer diff/test summaries. |

## Workflow Findings

| Area | Finding | Recommendation |
|---|---|---|
| First run | Operators need a single path from install to first PR. | Use `docs/GO_TO_WOAH.md` as the canonical runbook. |
| Queue model | Old Tasks/Blockers/Approvals routes created mental overhead. | Keep Tickets as the only queue surface. |
| Harness choice | Different teams prefer different coding agents. | Select harness by `YEET2_EXECUTOR_MODE`: `openhands`, `codex`, `claude`, `local`, or `passthrough`. |
| GitHub | PR creation depends on credentials and repo URL metadata. | Register projects by GitHub URL and set `GITHUB_TOKEN` before autonomous mode. |

## Added In This Pass

- `YEET2_EXECUTOR_MODE=codex` runs `codex exec` non-interactively against the prepared worktree.
- `YEET2_EXECUTOR_MODE=claude` runs `claude -p` in bare print mode against the prepared worktree.
- Both harnesses receive the generated task brief through stdin and log stdout/stderr to the job log.
- Both harnesses reuse the same Git worktree, timeout, artifact summary, and optional ASRT sandbox path as OpenHands.
- Docker executor images can optionally install both CLIs by setting `YEET2_INSTALL_CODE_HARNESSES=true`.

## Next Hardening Backlog

1. Add persistent async Executor job state so long harness runs are not tied to request lifetime.
2. Add harness-specific structured log parsers for Codex and Claude.
3. Add a UI field for default project/role adapter once the schema grows an `executorAdapter` column.
4. Add a preflight page that checks GitHub token, worker health, model credentials, and harness binary availability.
5. Add release image variants or tags for `openhands`, `codex`, and `claude` executor builds.
6. Add a production sandbox profile and make it the documented default for autonomous mode.

