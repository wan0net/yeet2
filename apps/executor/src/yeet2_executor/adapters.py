"""Execution adapter seams for yeet2."""

from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(value: str, fallback: str = "task") -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or fallback


def _run_git(args: list[str], cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=str(cwd) if cwd is not None else None,
        check=True,
        capture_output=True,
        text=True,
    )


def _write_log(path: Path, lines: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _append_log(path: Path, line: str) -> None:
    with path.open("a", encoding="utf-8") as handle:
        handle.write(f"{line}\n")


def _format_git_error(exc: subprocess.CalledProcessError) -> str:
    details = [f"command: {' '.join(exc.cmd)}", f"exit_code: {exc.returncode}"]
    if exc.stdout:
        details.append(f"stdout: {exc.stdout.strip()}")
    if exc.stderr:
        details.append(f"stderr: {exc.stderr.strip()}")
    return "; ".join(details)


def _is_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _truncate(value: str, limit: int = 140) -> str:
    if len(value) <= limit:
        return value
    return f"{value[: limit - 3].rstrip()}..."


def _build_task_file(workspace_path: Path, payload: dict[str, Any]) -> Path:
    task_dir = workspace_path / ".yeet2-executor"
    task_dir.mkdir(parents=True, exist_ok=True)
    task_file = task_dir / "task.txt"

    lines = [
        f"Task ID: {payload['task_id']}",
        f"Title: {payload['task_title']}",
        "",
        "Description:",
        str(payload["task_description"]).strip(),
        "",
    ]
    criteria = payload.get("acceptance_criteria")
    if isinstance(criteria, list) and criteria:
        lines.append("Acceptance Criteria:")
        lines.extend(f"- {item}" for item in criteria)
        lines.append("")
    lines.extend(
        [
            "Execution Constraints:",
            "- Work only inside the current workspace checkout.",
            "- Keep changes on the prepared yeet2 branch.",
            "- Run any local verification needed for the task when practical.",
        ]
    )

    task_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return task_file


def _summarize_jsonl_output(log_path: Path, exit_code: int) -> str:
    events = 0
    action_counts: Counter[str] = Counter()
    paths: list[str] = []
    last_error: str | None = None
    last_text: str | None = None

    with log_path.open(encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line.startswith("{"):
                if line and not line.startswith(
                    (
                        "[",
                        "task_id:",
                        "repo_path:",
                        "base_branch:",
                        "branch_name:",
                        "workspace_path:",
                        "task_file:",
                        "openhands_",
                        "verifying git repository",
                        "git worktree add completed",
                        "launching OpenHands headless run",
                    )
                ):
                    last_text = _truncate(line)
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(payload, dict):
                continue
            events += 1
            action = payload.get("action")
            if isinstance(action, str) and action:
                action_counts[action] += 1
            for key in ("path", "file", "filepath"):
                value = payload.get(key)
                if isinstance(value, str) and value and value not in paths:
                    paths.append(value)
            if payload.get("type") == "error":
                message = payload.get("content") or payload.get("message")
                if isinstance(message, str) and message.strip():
                    last_error = _truncate(message.strip())

    parts = [f"exit_code={exit_code}"]
    if events:
        parts.append(f"events={events}")
    if action_counts:
        top_actions = ", ".join(
            f"{name}={count}" for name, count in action_counts.most_common(3)
        )
        parts.append(f"actions={top_actions}")
    if paths:
        shown_paths = ", ".join(paths[:3])
        suffix = "..." if len(paths) > 3 else ""
        parts.append(f"paths={shown_paths}{suffix}")
    if last_error and exit_code != 0:
        parts.append(f"error={last_error}")
    elif last_text and exit_code != 0:
        parts.append(f"detail={last_text}")
    status = "completed successfully" if exit_code == 0 else "failed"
    return f"OpenHands {status} ({'; '.join(parts)})."


@dataclass(slots=True)
class JobRecord:
    id: str
    task_id: str
    status: str
    executor_type: str
    workspace_path: str
    branch_name: str
    log_path: str
    artifact_summary: str | None
    started_at: str | None
    completed_at: str | None
    payload: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "task_id": self.task_id,
            "status": self.status,
            "executor_type": self.executor_type,
            "workspace_path": self.workspace_path,
            "branch_name": self.branch_name,
            "log_path": self.log_path,
            "artifact_summary": self.artifact_summary,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "payload": self.payload,
        }


class OpenHandsLaunchError(RuntimeError):
    """Raised when the OpenHands subprocess cannot be started."""


class OpenHandsRuntimeError(RuntimeError):
    """Raised when the OpenHands subprocess starts but does not finish cleanly."""


class OpenHandsAdapter:
    """Replaceable adapter boundary for the first execution backend."""

    def __init__(self, base_dir: str | Path | None = None) -> None:
        root = base_dir or os.getenv("YEET2_EXECUTOR_BASE_DIR") or "/tmp/yeet2-executor"
        self.base_dir = Path(root).expanduser().resolve()
        self.workspaces_dir = self.base_dir / "workspaces"
        self.logs_dir = self.base_dir / "logs"
        self.workspaces_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)

    def create_job(self, task_id: str, payload: dict[str, Any]) -> JobRecord:
        job_id = str(uuid4())
        started_at = _utc_now()
        task_title = str(payload.get("task_title", "task")).strip()
        branch_name = f"yeet2/{_slugify(task_id)}-{_slugify(task_title)[:32]}-{job_id[:8]}"
        workspace_path = self.workspaces_dir / job_id
        log_path = self.logs_dir / f"{job_id}.log"
        normalized_payload = dict(payload)
        normalized_payload["task_id"] = task_id
        normalized_payload["branch_name"] = branch_name
        normalized_payload["workspace_path"] = str(workspace_path)
        normalized_payload["log_path"] = str(log_path)

        record = JobRecord(
            id=job_id,
            task_id=task_id,
            status="running",
            executor_type="openhands",
            workspace_path=str(workspace_path),
            branch_name=branch_name,
            log_path=str(log_path),
            artifact_summary=None,
            started_at=started_at,
            completed_at=None,
            payload=normalized_payload,
        )

        _write_log(
            log_path,
            [
                f"[{started_at}] yeet2 executor job created",
                f"task_id: {task_id}",
                f"repo_path: {payload.get('repo_path')}",
                f"base_branch: {payload.get('base_branch')}",
                f"branch_name: {branch_name}",
                f"workspace_path: {workspace_path}",
            ],
        )
        return record

    def run_job(self, record: JobRecord) -> JobRecord:
        log_path = Path(record.log_path)
        workspace_path = Path(record.workspace_path)

        try:
            repo_path = Path(str(record.payload["repo_path"])).expanduser().resolve()
            base_branch = str(record.payload["base_branch"]).strip()
            if not repo_path.exists():
                raise FileNotFoundError(f"repo_path does not exist: {repo_path}")
            if not base_branch:
                raise ValueError("base_branch is required")

            workspace_path.mkdir(parents=True, exist_ok=True)
            _append_log(log_path, "verifying git repository and creating isolated worktree")
            _run_git(["git", "-C", str(repo_path), "rev-parse", "--is-inside-work-tree"])
            result = _run_git(
                [
                    "git",
                    "-C",
                    str(repo_path),
                    "worktree",
                    "add",
                    "-b",
                    record.branch_name,
                    str(workspace_path),
                    base_branch,
                ]
            )
            if result.stdout.strip():
                _append_log(log_path, result.stdout.strip())
            if result.stderr.strip():
                _append_log(log_path, result.stderr.strip())
            _append_log(log_path, "git worktree add completed")

            record.payload["repo_path"] = str(repo_path)
            record.payload["base_branch"] = base_branch

            task_file = _build_task_file(workspace_path, record.payload)
            record.payload["task_file"] = str(task_file)
            _append_log(log_path, f"task_file: {task_file}")

            mode = (os.getenv("YEET2_EXECUTOR_MODE") or "openhands").strip().lower()
            record.payload["execution_mode"] = mode
            if mode == "local":
                summary = (
                    "Prepared local worktree only; OpenHands was skipped because "
                    "YEET2_EXECUTOR_MODE=local."
                )
                return self._complete_job(record, status="complete", summary=summary)

            if mode != "openhands":
                raise ValueError(
                    "YEET2_EXECUTOR_MODE must be either 'openhands' or 'local'"
                )

            _append_log(log_path, "launching OpenHands headless run")
            exit_code = self._run_openhands(workspace_path, task_file, log_path)
            summary = _summarize_jsonl_output(log_path, exit_code)
            status = "complete" if exit_code == 0 else "failed"
            error = summary if exit_code != 0 else None
            return self._complete_job(record, status=status, summary=summary, error=error)
        except subprocess.CalledProcessError as exc:
            summary = f"Local setup failed: {_format_git_error(exc)}"
            return self._complete_job(record, status="failed", summary=summary, error=summary)
        except OpenHandsLaunchError as exc:
            if _is_truthy(os.getenv("YEET2_OPENHANDS_ALLOW_LOCAL_FALLBACK")):
                summary = (
                    "OpenHands was unavailable, so the executor preserved the prepared local "
                    f"worktree instead ({exc})."
                )
                return self._complete_job(record, status="complete", summary=summary)
            summary = f"OpenHands failed to start: {exc}"
            return self._complete_job(record, status="failed", summary=summary, error=summary)
        except OpenHandsRuntimeError as exc:
            summary = f"OpenHands execution failed: {exc}"
            return self._complete_job(record, status="failed", summary=summary, error=summary)
        except Exception as exc:  # noqa: BLE001
            summary = f"Execution failed: {exc}"
            return self._complete_job(record, status="failed", summary=summary, error=str(exc))

    def _complete_job(
        self,
        record: JobRecord,
        *,
        status: str,
        summary: str,
        error: str | None = None,
    ) -> JobRecord:
        completed_at = _utc_now()
        _append_log(Path(record.log_path), f"[{completed_at}] {summary}")
        record.status = status
        record.artifact_summary = summary
        record.completed_at = completed_at
        if error is None:
            record.payload.pop("error", None)
        else:
            record.payload["error"] = error
        return record

    def _build_openhands_command(self, task_file: Path) -> list[str]:
        configured = os.getenv("YEET2_OPENHANDS_COMMAND")
        if configured and configured.strip():
            command = shlex.split(configured)
        else:
            python_version = (os.getenv("YEET2_OPENHANDS_PYTHON") or "3.12").strip() or "3.12"
            package = (os.getenv("YEET2_OPENHANDS_PACKAGE") or "openhands").strip()
            executable = (os.getenv("YEET2_OPENHANDS_BIN") or "openhands").strip()
            command = [
                "uvx",
                "--python",
                python_version,
                "--from",
                package,
                executable,
            ]

        extra_args = os.getenv("YEET2_OPENHANDS_EXTRA_ARGS")
        if extra_args and extra_args.strip():
            command.extend(shlex.split(extra_args))

        command.extend(
            ["--override-with-envs", "--headless", "--json", "--file", str(task_file)]
        )
        return command

    def _run_openhands(self, workspace_path: Path, task_file: Path, log_path: Path) -> int:
        command = self._build_openhands_command(task_file)
        timeout_value = os.getenv("YEET2_OPENHANDS_TIMEOUT_SECONDS")
        timeout_seconds: int | None = None
        if timeout_value and timeout_value.strip():
            timeout_seconds = int(timeout_value)
            if timeout_seconds <= 0:
                timeout_seconds = None

        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"

        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(f"openhands_cwd: {workspace_path}\n")
            handle.write(f"openhands_command: {shlex.join(command)}\n")
            handle.flush()
            try:
                process = subprocess.Popen(
                    command,
                    cwd=str(workspace_path),
                    stdout=handle,
                    stderr=subprocess.STDOUT,
                    text=True,
                    env=env,
                )
            except FileNotFoundError as exc:
                raise OpenHandsLaunchError(
                    f"command not found: {command[0]}"
                ) from exc
            except OSError as exc:
                raise OpenHandsLaunchError(str(exc)) from exc

            try:
                return process.wait(timeout=timeout_seconds)
            except subprocess.TimeoutExpired as exc:
                process.kill()
                process.wait()
                raise OpenHandsRuntimeError(
                    f"timed out after {timeout_seconds} seconds"
                ) from exc
