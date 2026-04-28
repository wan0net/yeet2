"""Integration boundary tests for Executor → OpenHands handoff.

These tests verify that the OpenHandsAdapter builds the correct subprocess
commands, sets the correct environment variables, and handles mode/timeout
configuration without actually launching OpenHands.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from yeet2_executor.adapters import (
    JobRecord,
    OpenHandsAdapter,
    OpenHandsLaunchError,
    _build_task_file,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_record(tmp_path: Path, payload: dict | None = None) -> JobRecord:
    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    log_path = tmp_path / "test.log"
    log_path.write_text("", encoding="utf-8")

    base_payload = {
        "repo_path": str(tmp_path / "repo"),
        "base_branch": "main",
        "task_id": "task-001",
        "task_title": "Build the API",
        "task_description": "Implement the REST endpoints.",
        "acceptance_criteria": ["Returns 200", "Under 200ms"],
    }
    if payload:
        base_payload.update(payload)

    return JobRecord(
        id="job-test-001",
        task_id="task-001",
        status="running",
        executor_type="openhands",
        workspace_path=str(workspace),
        branch_name="yeet2/task-001-build-api",
        log_path=str(log_path),
        artifact_summary=None,
        started_at="2026-01-01T00:00:00Z",
        completed_at=None,
        payload=base_payload,
    )


# ---------------------------------------------------------------------------
# _build_openhands_command — default
# ---------------------------------------------------------------------------

class TestBuildOpenHandsCommandDefault:
    def test_build_openhands_command_default(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("YEET2_OPENHANDS_COMMAND", raising=False)
        monkeypatch.delenv("YEET2_OPENHANDS_PYTHON", raising=False)
        monkeypatch.delenv("YEET2_OPENHANDS_PACKAGE", raising=False)
        monkeypatch.delenv("YEET2_OPENHANDS_BIN", raising=False)
        monkeypatch.delenv("YEET2_OPENHANDS_EXTRA_ARGS", raising=False)

        adapter = OpenHandsAdapter(base_dir=str(tmp_path))
        task_file = tmp_path / "task.txt"
        task_file.write_text("test", encoding="utf-8")

        command = adapter._build_openhands_command(task_file)

        assert command[0] == "uvx"
        assert "--python" in command
        idx_python = command.index("--python")
        assert command[idx_python + 1] == "3.12"
        assert "--from" in command
        idx_from = command.index("--from")
        assert command[idx_from + 1] == "openhands"
        assert "--headless" in command
        assert "--json" in command
        assert "--file" in command
        idx_file = command.index("--file")
        assert command[idx_file + 1] == str(task_file)


# ---------------------------------------------------------------------------
# _build_openhands_command — custom command
# ---------------------------------------------------------------------------

class TestBuildOpenHandsCommandCustom:
    def test_build_openhands_command_custom(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("YEET2_OPENHANDS_COMMAND", "custom-cmd --flag")
        monkeypatch.delenv("YEET2_OPENHANDS_EXTRA_ARGS", raising=False)

        adapter = OpenHandsAdapter(base_dir=str(tmp_path))
        task_file = tmp_path / "task.txt"
        task_file.write_text("test", encoding="utf-8")

        command = adapter._build_openhands_command(task_file)

        assert command[0] == "custom-cmd"
        assert command[1] == "--flag"
        # Standard flags must still be appended
        assert "--headless" in command
        assert "--file" in command


# ---------------------------------------------------------------------------
# coding harness commands — Codex and Claude
# ---------------------------------------------------------------------------

class TestBuildCodingHarnessCommands:
    def test_build_codex_command_default(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("YEET2_CODEX_COMMAND", raising=False)
        monkeypatch.delenv("YEET2_CODEX_EXTRA_ARGS", raising=False)
        monkeypatch.delenv("YEET2_CODEX_MODEL", raising=False)

        adapter = OpenHandsAdapter(base_dir=str(tmp_path))
        record = _make_record(tmp_path)

        command = adapter._build_codex_command(record, Path(record.workspace_path))

        assert command[:2] == ["codex", "exec"]
        assert "--cd" in command
        assert str(Path(record.workspace_path)) in command
        assert "--sandbox" in command
        assert "workspace-write" in command
        assert "--ask-for-approval" in command
        assert "never" in command
        assert command[-1] == "-"

    def test_build_claude_command_default_uses_print_mode(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("YEET2_CLAUDE_COMMAND", raising=False)
        monkeypatch.delenv("YEET2_CLAUDE_EXTRA_ARGS", raising=False)
        monkeypatch.delenv("YEET2_CLAUDE_MODEL", raising=False)

        adapter = OpenHandsAdapter(base_dir=str(tmp_path))
        record = _make_record(tmp_path)

        command = adapter._build_claude_command(record)

        assert command[0] == "claude"
        assert "-p" in command
        assert "--bare" in command
        assert "--permission-mode" in command
        assert "acceptEdits" in command
        assert "--output-format" in command
        assert "stream-json" in command

    def test_run_coding_harness_pipes_task_file_to_stdin(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("YEET2_EXECUTOR_SANDBOX_MODE", raising=False)
        monkeypatch.delenv("YEET2_CODEX_TIMEOUT_SECONDS", raising=False)
        adapter = OpenHandsAdapter(base_dir=str(tmp_path))
        record = _make_record(tmp_path)
        task_file = Path(record.workspace_path) / ".yeet2-executor" / "task.txt"
        task_file.parent.mkdir(parents=True, exist_ok=True)
        task_file.write_text("do the thing", encoding="utf-8")

        captured_input: list[str | None] = []

        def fake_popen(cmd, *, stdin, cwd, stdout, stderr, text, env, **kwargs):
            assert cmd[0] == "codex"
            assert stdin == subprocess.PIPE
            assert cwd == record.workspace_path
            mock_proc = MagicMock()
            mock_proc.communicate.side_effect = lambda input=None, timeout=None: captured_input.append(input)
            mock_proc.returncode = 0
            return mock_proc

        with patch("subprocess.Popen", side_effect=fake_popen):
            exit_code = adapter._run_coding_harness(record, Path(record.workspace_path), task_file, Path(record.log_path), False, "codex")

        assert exit_code == 0
        assert captured_input == ["do the thing"]


# ---------------------------------------------------------------------------
# _run_openhands — env passes LLM vars
# ---------------------------------------------------------------------------

class TestOpenHandsEnvPassesLlmVars:
    def test_openhands_env_passes_llm_vars(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("YEET2_ASRT_ENABLED", raising=False)
        monkeypatch.delenv("YEET2_EXECUTOR_SANDBOX_MODE", raising=False)
        monkeypatch.delenv("YEET2_OPENHANDS_COMMAND", raising=False)
        monkeypatch.delenv("YEET2_OPENHANDS_EXTRA_ARGS", raising=False)
        monkeypatch.delenv("YEET2_OPENHANDS_TIMEOUT_SECONDS", raising=False)

        adapter = OpenHandsAdapter(base_dir=str(tmp_path))
        record = _make_record(tmp_path, {"llm_model": "openai/gpt-4o"})
        task_file = tmp_path / "task.txt"
        task_file.write_text("test", encoding="utf-8")

        captured_env: dict[str, str] = {}

        def fake_popen(cmd, *, cwd, stdout, stderr, text, env, **kwargs):
            captured_env.update(env or {})
            mock_proc = MagicMock()
            mock_proc.wait.return_value = 0
            return mock_proc

        with patch("subprocess.Popen", side_effect=fake_popen):
            adapter._run_openhands(record, Path(record.workspace_path), task_file, Path(record.log_path), False)

        assert captured_env.get("LLM_MODEL") == "openai/gpt-4o"
        assert captured_env.get("OPENAI_MODEL_NAME") == "openai/gpt-4o"
        assert captured_env.get("MODEL") == "openai/gpt-4o"


# ---------------------------------------------------------------------------
# _run_openhands — timeout from env
# ---------------------------------------------------------------------------

class TestOpenHandsTimeoutFromEnv:
    def test_openhands_timeout_from_env(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("YEET2_OPENHANDS_TIMEOUT_SECONDS", "60")
        monkeypatch.delenv("YEET2_ASRT_ENABLED", raising=False)
        monkeypatch.delenv("YEET2_EXECUTOR_SANDBOX_MODE", raising=False)
        monkeypatch.delenv("YEET2_OPENHANDS_COMMAND", raising=False)
        monkeypatch.delenv("YEET2_OPENHANDS_EXTRA_ARGS", raising=False)

        adapter = OpenHandsAdapter(base_dir=str(tmp_path))
        record = _make_record(tmp_path)
        task_file = tmp_path / "task.txt"
        task_file.write_text("test", encoding="utf-8")

        captured_timeout: list[int | None] = []

        def fake_popen(cmd, **kwargs):
            mock_proc = MagicMock()

            def wait_with_timeout(timeout=None):
                captured_timeout.append(timeout)
                return 0

            mock_proc.wait.side_effect = wait_with_timeout
            return mock_proc

        with patch("subprocess.Popen", side_effect=fake_popen):
            adapter._run_openhands(record, Path(record.workspace_path), task_file, Path(record.log_path), False)

        assert captured_timeout == [60]

    def test_openhands_timeout_default_none(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("YEET2_OPENHANDS_TIMEOUT_SECONDS", raising=False)
        monkeypatch.delenv("YEET2_ASRT_ENABLED", raising=False)
        monkeypatch.delenv("YEET2_EXECUTOR_SANDBOX_MODE", raising=False)
        monkeypatch.delenv("YEET2_OPENHANDS_COMMAND", raising=False)
        monkeypatch.delenv("YEET2_OPENHANDS_EXTRA_ARGS", raising=False)

        adapter = OpenHandsAdapter(base_dir=str(tmp_path))
        record = _make_record(tmp_path)
        task_file = tmp_path / "task.txt"
        task_file.write_text("test", encoding="utf-8")

        captured_timeout: list[int | None] = []

        def fake_popen(cmd, **kwargs):
            mock_proc = MagicMock()

            def wait_with_timeout(timeout=None):
                captured_timeout.append(timeout)
                return 0

            mock_proc.wait.side_effect = wait_with_timeout
            return mock_proc

        with patch("subprocess.Popen", side_effect=fake_popen):
            adapter._run_openhands(record, Path(record.workspace_path), task_file, Path(record.log_path), False)

        assert captured_timeout == [None]


# ---------------------------------------------------------------------------
# _build_task_file — required fields
# ---------------------------------------------------------------------------

class TestTaskFileContainsRequiredFields:
    def test_task_file_contains_required_fields(self, tmp_path: Path) -> None:
        workspace = tmp_path / "workspace"
        payload = {
            "task_id": "task-xyz",
            "task_title": "Implement authentication",
            "task_description": "Add JWT-based auth to all endpoints.",
            "acceptance_criteria": [
                "All endpoints require a valid token",
                "Invalid tokens return 401",
            ],
        }

        task_file = _build_task_file(workspace, payload)
        content = task_file.read_text(encoding="utf-8")

        assert "Implement authentication" in content
        assert "Add JWT-based auth to all endpoints." in content
        assert "All endpoints require a valid token" in content
        assert "Invalid tokens return 401" in content
        assert "task-xyz" in content

    def test_task_file_includes_operator_guidance(self, tmp_path: Path) -> None:
        workspace = tmp_path / "workspace2"
        payload = {
            "task_id": "task-xyz",
            "task_title": "Build API",
            "task_description": "Build the REST API.",
            "acceptance_criteria": [],
            "metadata": {
                "operator_guidance": [
                    {"actor": "lead", "content": "Focus on auth first"},
                ]
            },
        }

        task_file = _build_task_file(workspace, payload)
        content = task_file.read_text(encoding="utf-8")

        assert "Focus on auth first" in content
        assert "lead" in content


# ---------------------------------------------------------------------------
# run_job — local mode
# ---------------------------------------------------------------------------

class TestRunJobLocalMode:
    def test_run_job_local_mode(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("YEET2_EXECUTOR_MODE", "local")
        monkeypatch.setenv("YEET2_EXECUTOR_WORKTREE_CLEANUP", "never")

        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        adapter = OpenHandsAdapter(base_dir=str(tmp_path))
        record = _make_record(tmp_path, {"repo_path": str(repo_path)})

        def fake_run_git(args, cwd=None):
            result = MagicMock(spec=subprocess.CompletedProcess)
            result.stdout = ""
            result.stderr = ""
            result.returncode = 0
            return result

        popen_called = []

        def assert_no_popen(*args, **kwargs):
            popen_called.append(True)
            raise AssertionError("subprocess.Popen must not be called in local mode")

        with (
            patch("yeet2_executor.adapters._run_git", side_effect=fake_run_git),
            patch("subprocess.Popen", side_effect=assert_no_popen),
        ):
            result = adapter.run_job(record)

        assert not popen_called, "OpenHands must not be launched in local mode"
        assert result.status == "complete"
        assert result.artifact_summary is not None
        assert "local" in (result.artifact_summary or "").lower()
