# yeet2 Executor

Execution service for yeet2 jobs.

`POST /jobs` validates the execution payload, prepares a yeet2-owned Git worktree, writes a per-job log, and then runs OpenHands headlessly inside that prepared workspace. The HTTP response shape stays the same as before:

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

The service is still synchronous today, so `POST /jobs` blocks until OpenHands exits. The job record is created in `running` state before the subprocess starts, which lets concurrent `GET /jobs/:id` calls observe the in-flight job while the request is still being processed.

## Runtime knobs

- `YEET2_EXECUTOR_BASE_DIR`: workspace root for prepared worktrees and logs. Default: `/tmp/yeet2-executor`
- `YEET2_EXECUTOR_MODE`: `openhands` by default. Set to `local` to keep the old worktree-only fallback mode.
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
- `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`: pass provider credentials/model settings through to OpenHands. The executor includes `--override-with-envs` in its managed flags so these env vars are honored by the subprocess.

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

## Prerequisites

- `uv`/`uvx` installed on the host if you use the default command path
- `srt` installed on the host if you enable `YEET2_EXECUTOR_SANDBOX_MODE=asrt`
- OpenHands-compatible model/provider environment configured for the subprocess, typically via `LLM_API_KEY`, `LLM_MODEL`, and optionally `LLM_BASE_URL`
- Git available locally so the executor can create isolated worktrees
