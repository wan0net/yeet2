# yeet2 Executor

Execution service for yeet2 jobs.

`POST /jobs` validates the execution payload, prepares a yeet2-owned Git worktree, writes a per-job log, and then runs the configured coding harness headlessly inside that prepared workspace. The HTTP response shape stays the same as before:

- `id`
- `task_id`
- `status`
- `executor_type`
- `workspace_path`
- `branch_name`
- `log_path`
- `artifact_summary`
- `started_at`
- `completed_at`
- `payload`

The service is still synchronous today, so `POST /jobs` blocks until the configured harness exits. The job record is created in `running` state before the subprocess starts, which lets concurrent `GET /jobs/:id` calls observe the in-flight job while the request is still being processed.

## Runtime knobs

- `YEET2_EXECUTOR_BASE_DIR`: workspace root for prepared worktrees and logs. Default: `/tmp/yeet2-executor`
- `YEET2_EXECUTOR_MODE`: `openhands` by default. Supported values: `openhands`, `codex`, `claude`, `local`, `passthrough`.
- `YEET2_HARNESS_TIMEOUT_SECONDS`: shared timeout for Codex/Claude runs. Default in compose: `1800`.
- `YEET2_EXECUTOR_SANDBOX_MODE`: sandbox policy for executor jobs. Leave unset or set to `off` for the direct host path. Set to `asrt` to wrap the OpenHands command with `srt` and a per-job ASRT config.
- `YEET2_EXECUTOR_SANDBOX_BIN`: sandbox launcher binary when ASRT mode is enabled. Default: `srt`
- `YEET2_EXECUTOR_SANDBOX_BASE_CONFIG`: optional JSON object file path merged into each per-job sandbox config before launch.
- `YEET2_EXECUTOR_SANDBOX_EXTRA_ARGS`: optional extra flags appended to the sandbox launcher before the wrapped OpenHands command.
- `YEET2_EXECUTOR_SANDBOX_NETWORK`: optional comma-separated network allowlist merged into the generated ASRT config. Leave unset to use the executor default.
- `YEET2_OPENHANDS_COMMAND`: optional base command override. The executor still appends `--override-with-envs --headless --json --file <generated task file>`.
- `YEET2_OPENHANDS_EXTRA_ARGS`: optional extra CLI flags appended before the executor-managed OpenHands flags.
- `YEET2_OPENHANDS_PYTHON`: Python version for the default `uvx` invocation. Default: `3.12`
- `YEET2_OPENHANDS_PACKAGE`: package used by the default `uvx --from ...` command. Default: `openhands`
- `YEET2_OPENHANDS_BIN`: executable used by the default `uvx` command. Default: `openhands`
- `YEET2_OPENHANDS_TIMEOUT_SECONDS`: optional hard timeout for the OpenHands subprocess. Unset means no timeout.
- `YEET2_OPENHANDS_ALLOW_LOCAL_FALLBACK`: if true, a command-start failure falls back to a prepared local worktree instead of marking the job failed
- `YEET2_CODEX_COMMAND`: optional Codex CLI command override. Default: `codex exec --cd <workspace> --sandbox workspace-write --ask-for-approval never --skip-git-repo-check --json -`.
- `YEET2_CODEX_EXTRA_ARGS`: optional extra Codex CLI flags appended before the stdin marker.
- `YEET2_CODEX_MODEL`: optional Codex model override.
- `YEET2_CODEX_TIMEOUT_SECONDS`: Codex-specific timeout.
- `YEET2_CLAUDE_COMMAND`: optional Claude Code command override. Default: `claude -p --bare --permission-mode acceptEdits --output-format stream-json`.
- `YEET2_CLAUDE_EXTRA_ARGS`: optional extra Claude Code flags.
- `YEET2_CLAUDE_MODEL`: optional Claude model override, e.g. `sonnet`.
- `YEET2_CLAUDE_TIMEOUT_SECONDS`: Claude-specific timeout.
- `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`: pass provider credentials/model settings through to OpenHands. The executor includes `--override-with-envs` in its managed flags so these env vars are honored by the subprocess.
- `OPENAI_API_KEY`: used by Codex CLI.
- `ANTHROPIC_API_KEY`: used by Claude Code, especially with the default `--bare` command.

## Sandbox mode

The executor now supports a yeet2-owned ASRT sandbox path for job subprocesses.

- `off` keeps the existing direct host execution path.
- `asrt` renders a per-job ASRT config under the executor base dir and launches OpenHands through `srt --settings <config> ...`.

This keeps sandbox policy owned by yeet2 instead of pushing sandbox setup into the operator shell. In ASRT mode the executor:

- renders a per-job config in the executor ASRT config directory
- merges `YEET2_EXECUTOR_SANDBOX_BASE_CONFIG` when it points to a JSON object file, then folds that policy into each per-job render
- applies sandbox network overrides from `YEET2_EXECUTOR_SANDBOX_NETWORK`
- launches the prepared OpenHands command through `YEET2_EXECUTOR_SANDBOX_BIN` with `--settings <config>` plus executor-managed sandbox args

This is meant to be sharkcage-inspired policy input, not a shared mutable runtime file. Each job gets its own rendered ASRT config so per-workspace paths stay isolated.

Legacy compatibility aliases still supported by the executor include `YEET2_ASRT_ENABLED`, `YEET2_ASRT_SRT_BIN`, and `YEET2_ASRT_ALLOWED_DOMAINS`. Prefer the `YEET2_EXECUTOR_SANDBOX_*` names for new setups.

## Default OpenHands path

If `YEET2_OPENHANDS_COMMAND` is unset, the executor builds this default command:

```bash
uvx --python 3.12 --from openhands openhands --override-with-envs --headless --json --file <task-file>
```

The generated task file lives inside the prepared workspace under `.yeet2-executor/task.txt`, and stdout/stderr from OpenHands are appended directly to the job log file. If you rely on environment-based model configuration, set `LLM_API_KEY` plus the matching `LLM_MODEL` and optional `LLM_BASE_URL` before starting the executor.

When `YEET2_EXECUTOR_SANDBOX_MODE=asrt`, the executor keeps that same OpenHands command shape but prepends the sandbox launcher and passes the rendered config with `--settings <config>`.

## Codex CLI path

Set:

```bash
YEET2_EXECUTOR_MODE=codex
OPENAI_API_KEY=sk-...
```

Default command shape:

```bash
codex exec --cd <workspace> --sandbox workspace-write --ask-for-approval never --skip-git-repo-check --json -
```

The generated task file is sent on stdin. The run stays inside the prepared yeet2 worktree and writes stdout/stderr to the job log.

## Claude Code path

Set:

```bash
YEET2_EXECUTOR_MODE=claude
ANTHROPIC_API_KEY=sk-ant-...
YEET2_CLAUDE_MODEL=sonnet
```

Default command shape:

```bash
claude -p --bare --permission-mode acceptEdits --output-format stream-json
```

The generated task file is sent on stdin. `--bare` avoids implicit user config/keychain discovery; provide `ANTHROPIC_API_KEY` or a deliberate `YEET2_CLAUDE_COMMAND` override.

## Prerequisites

- `uv`/`uvx` installed on the host if you use the default command path
- `codex` installed on the host or in the executor image for Codex mode
- `claude` installed on the host or in the executor image for Claude mode
- `srt` installed on the host if you enable `YEET2_EXECUTOR_SANDBOX_MODE=asrt`
- OpenHands-compatible model/provider environment configured for the subprocess, typically via `LLM_API_KEY`, `LLM_MODEL`, and optionally `LLM_BASE_URL`
- Git available locally so the executor can create isolated worktrees
