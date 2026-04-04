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
from urllib.parse import urlparse
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


def cleanText(value: Any | None) -> str:
    if isinstance(value, str):
        return value.strip()
    if value is None:
        return ""
    return str(value).strip()


def _split_csv_env(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _normalize_host(value: str) -> str:
    parsed = urlparse(value if "://" in value else f"//{value}")
    host = parsed.hostname or ""
    return host.strip().lower()


def _is_dangerous_allowed_host(value: str) -> bool:
    host = value.strip().lower()
    if not host:
        return True

    if host.startswith("[") and "]" in host:
        host = host[1 : host.index("]")]
    if ":" in host and host.count(":") == 1 and not host.startswith("::"):
        host = host.rsplit(":", 1)[0]

    if host in {
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "::1",
        "::",
        "169.254.169.254",
        "metadata",
        "metadata.google.internal",
        "100.100.100.100",
    }:
        return True

    for prefix in ("127.", "10.", "192.168.", "169.254."):
        if host.startswith(prefix):
            return True

    if host.startswith("172."):
        parts = host.split(".")
        if len(parts) >= 2 and parts[0] == "172":
            try:
                octet = int(parts[1])
            except ValueError:
                return False
            return 16 <= octet <= 31

    return False


def _mandatory_deny_read_paths() -> list[str]:
    home = Path.home()
    return [
        str(home / ".ssh"),
        str(home / ".aws"),
        str(home / ".gnupg"),
        str(home / ".netrc"),
        str(home / ".npmrc"),
        str(home / ".docker"),
        str(home / ".kube"),
        str(home / ".config" / "gh"),
        str(home / ".config" / "gcloud"),
        str(home / ".config" / "op"),
        str(home / ".password-store"),
        str(home / ".bashrc"),
        str(home / ".zshrc"),
        str(home / ".bash_profile"),
        str(home / ".zprofile"),
        str(home / ".profile"),
        str(home / ".bash_history"),
        str(home / ".zsh_history"),
        str(home / ".gitconfig"),
        str(home / ".yeet2"),
        str(home / ".config" / "yeet2"),
    ]


def _filter_allowed_domains(values: Any) -> list[str]:
    domains: list[str] = []
    if not isinstance(values, list):
        return domains

    for value in values:
        if not isinstance(value, str):
            continue
        host = _normalize_host(value)
        if not host or _is_dangerous_allowed_host(host):
            continue
        if host not in domains:
            domains.append(host)
    return domains


def _build_asrt_allowed_domains() -> list[str]:
    domains: list[str] = []
    llm_base_url = cleanText(os.getenv("LLM_BASE_URL"))
    if llm_base_url:
        host = _normalize_host(llm_base_url)
        if host and not _is_dangerous_allowed_host(host):
            domains.append(host)

    for env_name in (
        "YEET2_EXECUTOR_SANDBOX_ALLOWED_DOMAINS",
        "YEET2_EXECUTOR_SANDBOX_NETWORK",
        "YEET2_ASRT_ALLOWED_DOMAINS",
    ):
        for raw_domain in _split_csv_env(os.getenv(env_name)):
            host = _normalize_host(raw_domain)
            if host and not _is_dangerous_allowed_host(host):
                domains.append(host)

    return list(dict.fromkeys(domains))


def _build_asrt_deny_read_paths() -> list[str]:
    paths = _mandatory_deny_read_paths()
    for env_name in (
        "YEET2_EXECUTOR_SANDBOX_EXTRA_DENY_READ_PATHS",
        "YEET2_ASRT_EXTRA_DENY_READ_PATHS",
    ):
        paths.extend(_split_csv_env(os.getenv(env_name)))
    return list(dict.fromkeys(paths))


def _load_base_asrt_config(sandbox_enabled: bool) -> dict[str, Any] | None:
    raw_value = cleanText(os.getenv("YEET2_EXECUTOR_SANDBOX_BASE_CONFIG"))
    if not raw_value:
        return None

    candidate_path = Path(raw_value).expanduser()
    if not candidate_path.exists():
        if sandbox_enabled:
            raise OpenHandsLaunchError(f"ASRT base config not found: {candidate_path}")
        return None
    if not candidate_path.is_file():
        if sandbox_enabled:
            raise OpenHandsLaunchError(f"ASRT base config is not a file: {candidate_path}")
        return None

    try:
        text = candidate_path.read_text(encoding="utf-8")
    except OSError as exc:
        if sandbox_enabled:
            raise OpenHandsLaunchError(f"ASRT base config is unreadable: {candidate_path}") from exc
        return None

    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        if sandbox_enabled:
            raise OpenHandsLaunchError(f"ASRT base config is not valid JSON: {candidate_path}")
        return None

    if isinstance(payload, dict):
        return payload
    if sandbox_enabled:
        raise OpenHandsLaunchError(f"ASRT base config must contain a JSON object: {candidate_path}")
    return None


def _merge_unique_strings(*values: Any) -> list[str]:
    merged: list[str] = []
    for value in values:
        if isinstance(value, list):
            for item in value:
                if isinstance(item, str) and item not in merged:
                    merged.append(item)
    return merged


def _sandbox_extra_args() -> list[str]:
    return shlex.split(cleanText(os.getenv("YEET2_EXECUTOR_SANDBOX_EXTRA_ARGS")))


def _truncate(value: str, limit: int = 140) -> str:
    if len(value) <= limit:
        return value
    return f"{value[: limit - 3].rstrip()}..."


def _is_asrt_enabled() -> bool:
    sandbox_mode = cleanText(os.getenv("YEET2_EXECUTOR_SANDBOX_MODE")).lower()
    if sandbox_mode == "asrt":
        return True
    if sandbox_mode in {"off", "disabled", "none"}:
        return False
    return _is_truthy(os.getenv("YEET2_ASRT_ENABLED"))


def _resolve_srt_binary() -> str:
    configured = cleanText(os.getenv("YEET2_ASRT_SRT_BIN")) or cleanText(os.getenv("YEET2_EXECUTOR_SANDBOX_BIN"))
    return configured or "srt"


def _build_task_file(workspace_path: Path, payload: dict[str, Any]) -> Path:
    task_dir = workspace_path / ".yeet2-executor"
    task_dir.mkdir(parents=True, exist_ok=True)
    task_file = task_dir / "task.txt"

    lines = [
        f"Task ID: {payload['task_id']}",
        f"Title: {payload['task_title']}",
        f"Assigned Staff: {cleanText(payload.get('assigned_role_definition_label')) or 'Unassigned'}",
        f"Assigned Model: {cleanText(payload.get('llm_model')) or 'Executor default'}",
        "",
        "Description:",
        str(payload["task_description"]).strip(),
        "",
    ]
    metadata = payload.get("metadata")
    if isinstance(metadata, dict):
        operator_guidance = metadata.get("operator_guidance")
        if isinstance(operator_guidance, list):
            guidance_lines = []
            for entry in operator_guidance[:4]:
                if not isinstance(entry, dict):
                    continue
                actor = cleanText(entry.get("actor")) or "operator"
                content = cleanText(entry.get("content"))
                if content:
                    guidance_lines.append(f"- {actor}: {content}")
            if guidance_lines:
                lines.extend(["Operator Guidance:"])
                lines.extend(guidance_lines)
                lines.append("")
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


def _build_asrt_config(workspace_path: Path, sandbox_enabled: bool) -> dict[str, Any]:
    base_config = _load_base_asrt_config(sandbox_enabled) or {}
    base_network = base_config.get("network") if isinstance(base_config.get("network"), dict) else {}
    base_filesystem = base_config.get("filesystem") if isinstance(base_config.get("filesystem"), dict) else {}

    return {
        **base_config,
        "network": {
            **base_network,
            "allowedDomains": _filter_allowed_domains(_merge_unique_strings(_build_asrt_allowed_domains(), base_network.get("allowedDomains"))),
            "deniedDomains": _merge_unique_strings(base_network.get("deniedDomains")),
            "allowLocalBinding": False,
            "allowUnixSockets": [],
        },
        "filesystem": {
            **base_filesystem,
            "allowRead": _merge_unique_strings(base_filesystem.get("allowRead"), [str(workspace_path)]),
            "allowWrite": _merge_unique_strings(base_filesystem.get("allowWrite"), [str(workspace_path)]),
            "denyRead": _merge_unique_strings(base_filesystem.get("denyRead"), _build_asrt_deny_read_paths()),
            "denyWrite": _merge_unique_strings(base_filesystem.get("denyWrite")),
        },
    }


def _write_asrt_config(config_dir: Path, job_id: str, config: dict[str, Any]) -> Path:
    config_dir.mkdir(parents=True, exist_ok=True)
    config_path = config_dir / f"{job_id}.json"
    config_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    config_path.chmod(0o600)
    return config_path


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
        self.asrt_configs_dir = self.base_dir / "asrt-configs"
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
        normalized_payload["sandbox_mode"] = "asrt" if _is_asrt_enabled() else "off"

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
                f"sandbox_mode: {normalized_payload['sandbox_mode']}",
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
            assigned_staff = cleanText(record.payload.get("metadata", {}).get("assigned_role_definition_label") if isinstance(record.payload.get("metadata"), dict) else "")
            assigned_model = cleanText(record.payload.get("llm_model"))
            if assigned_staff:
                _append_log(log_path, f"assigned_staff: {assigned_staff}")
            if assigned_model:
                _append_log(log_path, f"assigned_model: {assigned_model}")

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

            sandbox_enabled = _is_asrt_enabled()
            record.payload["sandbox_mode"] = "asrt" if sandbox_enabled else "off"
            _append_log(log_path, f"sandbox_mode: {record.payload['sandbox_mode']}")
            _append_log(log_path, "launching OpenHands headless run")
            exit_code = self._run_openhands(record, workspace_path, task_file, log_path, sandbox_enabled)
            summary = _summarize_jsonl_output(log_path, exit_code)
            status = "complete" if exit_code == 0 else "failed"
            error = summary if exit_code != 0 else None
            return self._complete_job(record, status=status, summary=summary, error=error)
        except subprocess.CalledProcessError as exc:
            summary = f"Local setup failed: {_format_git_error(exc)}"
            return self._complete_job(record, status="failed", summary=summary, error=summary)
        except OpenHandsLaunchError as exc:
            if _is_truthy(os.getenv("YEET2_OPENHANDS_ALLOW_LOCAL_FALLBACK")) and record.payload.get("sandbox_mode") != "asrt":
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

        self._cleanup_worktree(record, status)
        return record

    def _cleanup_worktree(self, record: JobRecord, status: str) -> None:
        cleanup_policy = (os.getenv("YEET2_EXECUTOR_WORKTREE_CLEANUP") or "on_success").strip().lower()
        if cleanup_policy == "never":
            return

        if status != "complete" and cleanup_policy != "always":
            return

        repo_path = record.payload.get("repo_path")
        workspace_path = record.workspace_path
        if not repo_path or not workspace_path:
            return

        try:
            _run_git(["git", "-C", str(repo_path), "worktree", "remove", "--force", str(workspace_path)])
            _append_log(Path(record.log_path), f"[{_utc_now()}] worktree removed: {workspace_path}")
        except Exception:  # noqa: BLE001
            _append_log(Path(record.log_path), f"[{_utc_now()}] worktree cleanup skipped (non-fatal)")

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

    def _run_openhands(
        self,
        record: JobRecord,
        workspace_path: Path,
        task_file: Path,
        log_path: Path,
        sandbox_enabled: bool,
    ) -> int:
        command = self._build_openhands_command(task_file)
        timeout_value = os.getenv("YEET2_OPENHANDS_TIMEOUT_SECONDS")
        timeout_seconds: int | None = None
        if timeout_value and timeout_value.strip():
            timeout_seconds = int(timeout_value)
            if timeout_seconds <= 0:
                timeout_seconds = None

        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        llm_model_override = cleanText(record.payload.get("llm_model"))
        if llm_model_override:
            env["LLM_MODEL"] = llm_model_override
            env["OPENAI_MODEL_NAME"] = llm_model_override
            env["MODEL"] = llm_model_override

        launch_command = command
        config_path: Path | None = None
        if sandbox_enabled:
            config_path = _write_asrt_config(self.asrt_configs_dir, record.id, _build_asrt_config(workspace_path, sandbox_enabled))
            launch_command = [_resolve_srt_binary(), *_sandbox_extra_args(), "--settings", str(config_path), *command]
            record.payload["sandbox_config_path"] = str(config_path)
            record.payload["sandbox_wrapped_command"] = shlex.join(launch_command)
        else:
            record.payload.pop("sandbox_config_path", None)
            record.payload.pop("sandbox_wrapped_command", None)

        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(f"openhands_cwd: {workspace_path}\n")
            handle.write(f"openhands_command: {shlex.join(command)}\n")
            handle.write(f"sandbox_command: {shlex.join(launch_command)}\n")
            if config_path is not None:
                handle.write(f"sandbox_config_path: {config_path}\n")
            handle.flush()
            try:
                process = subprocess.Popen(
                    launch_command,
                    cwd=str(workspace_path),
                    stdout=handle,
                    stderr=subprocess.STDOUT,
                    text=True,
                    env=env,
                )
            except FileNotFoundError as exc:
                missing = launch_command[0] if launch_command else command[0]
                raise OpenHandsLaunchError(f"command not found: {missing}") from exc
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


class PassthroughAdapter:
    """LLM-only adapter. Sends the stage brief to a model, stores the response."""

    def __init__(self, base_dir: str | Path | None = None) -> None:
        root = base_dir or os.getenv("YEET2_EXECUTOR_BASE_DIR") or "/tmp/yeet2-executor"
        self.base_dir = Path(root).expanduser().resolve()
        self.logs_dir = self.base_dir / "logs"
        self.logs_dir.mkdir(parents=True, exist_ok=True)

    def create_job(self, task_id: str, payload: dict[str, Any]) -> JobRecord:
        job_id = str(uuid4())
        started_at = _utc_now()
        task_title = str(payload.get("task_title", "task")).strip()
        log_path = self.logs_dir / f"{job_id}.log"

        record = JobRecord(
            id=job_id,
            task_id=task_id,
            status="running",
            executor_type="passthrough",
            workspace_path="",
            branch_name="",
            log_path=str(log_path),
            artifact_summary=None,
            started_at=started_at,
            completed_at=None,
            payload=dict(payload, task_id=task_id, log_path=str(log_path)),
        )

        _write_log(log_path, [
            f"[{started_at}] passthrough job created",
            f"task_id: {task_id}",
            f"task_title: {task_title}",
        ])
        return record

    def run_job(self, record: JobRecord) -> JobRecord:
        log_path = Path(record.log_path)
        _append_log(log_path, "starting LLM passthrough call")

        task_description = str(record.payload.get("task_description", "")).strip()
        task_title = str(record.payload.get("task_title", "")).strip()
        acceptance_criteria = record.payload.get("acceptance_criteria") or []

        if not task_description:
            return self._complete_job(record, status="failed", summary="No task description provided.")

        # Build the prompt
        parts = [task_description]
        if acceptance_criteria:
            parts.append("\nAcceptance criteria:")
            for criterion in acceptance_criteria:
                if isinstance(criterion, str):
                    parts.append(f"- {criterion}")
        prompt = "\n".join(parts)

        # Resolve LLM settings
        model = (
            record.payload.get("llm_model")
            or os.getenv("LLM_MODEL")
            or os.getenv("YEET2_PASSTHROUGH_MODEL")
            or "openrouter/anthropic/claude-sonnet-4-5"
        )
        api_key = os.getenv("LLM_API_KEY") or os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("LLM_BASE_URL") or "https://openrouter.ai/api/v1"

        if not api_key:
            return self._complete_job(record, status="failed", summary="No LLM API key configured for passthrough adapter.")

        _append_log(log_path, f"calling {model} via {base_url}")

        try:
            import openai  # noqa: PLC0415
            client = openai.OpenAI(api_key=api_key, base_url=base_url)
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": f"You are an AI agent working on task: {task_title}. Produce a thorough, actionable response."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
            )
            content = response.choices[0].message.content or ""
            _append_log(log_path, f"LLM response received ({len(content)} chars)")
            return self._complete_job(record, status="complete", summary=content)
        except Exception as exc:  # noqa: BLE001
            error_msg = f"LLM call failed: {exc}"
            _append_log(log_path, error_msg)
            return self._complete_job(record, status="failed", summary=error_msg, error=error_msg)

    def _complete_job(self, record: JobRecord, *, status: str, summary: str, error: str | None = None) -> JobRecord:
        completed_at = _utc_now()
        _append_log(Path(record.log_path), f"[{completed_at}] {summary[:200]}")
        record.status = status
        record.artifact_summary = summary
        record.completed_at = completed_at
        if error is None:
            record.payload.pop("error", None)
        else:
            record.payload["error"] = error
        return record
