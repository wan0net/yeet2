"""Tests for yeet2_executor.adapters."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from yeet2_executor.adapters import (
    JobRecord,
    OpenHandsAdapter,
    _build_task_file,
    _clone_url_with_credentials,
    _filter_allowed_domains,
    _is_dangerous_allowed_host,
    _is_safe_git_clone_url,
    _make_openai_client,
    _mandatory_deny_read_paths,
    _slugify,
    _summarize_jsonl_output,
)


# ---------------------------------------------------------------------------
# _slugify
# ---------------------------------------------------------------------------


def test_slugify():
    assert _slugify("Hello World!") == "hello-world"


def test_slugify_empty():
    assert _slugify("") == "task"


def test_slugify_uses_custom_fallback():
    assert _slugify("", fallback="task") == "task"


def test_slugify_strips_leading_trailing_hyphens():
    assert _slugify("---foo---") == "foo"


# ---------------------------------------------------------------------------
# _is_dangerous_allowed_host
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "host",
    [
        "localhost",
        "127.0.0.1",
        "10.0.0.1",
        "192.168.1.1",
        "169.254.169.254",
        "0.0.0.0",
        "::1",
        "metadata",
        "metadata.google.internal",
    ],
)
def test_is_dangerous_allowed_host(host):
    assert _is_dangerous_allowed_host(host) is True


@pytest.mark.parametrize(
    "host",
    [
        "github.com",
        "pypi.org",
        "openrouter.ai",
        "api.anthropic.com",
    ],
)
def test_is_not_dangerous_host(host):
    assert _is_dangerous_allowed_host(host) is False


# ---------------------------------------------------------------------------
# _mandatory_deny_read_paths
# ---------------------------------------------------------------------------


def test_mandatory_deny_read_paths():
    paths = _mandatory_deny_read_paths()
    home = Path.home()
    for suffix in [".ssh", ".aws", ".gnupg", ".docker", ".kube"]:
        assert str(home / suffix) in paths, f"Expected {home / suffix} in deny list"


def test_mandatory_deny_read_paths_returns_strings():
    paths = _mandatory_deny_read_paths()
    assert all(isinstance(p, str) for p in paths)


def test_mandatory_deny_read_paths_no_duplicates():
    paths = _mandatory_deny_read_paths()
    assert len(paths) == len(set(paths))


# ---------------------------------------------------------------------------
# _filter_allowed_domains
# ---------------------------------------------------------------------------


def test_filter_allowed_domains():
    mixed = [
        "github.com",
        "127.0.0.1",
        "localhost",
        "pypi.org",
        "192.168.1.5",
        "openrouter.ai",
    ]
    result = _filter_allowed_domains(mixed)
    assert "github.com" in result
    assert "pypi.org" in result
    assert "openrouter.ai" in result
    # dangerous hosts must be excluded
    assert "127.0.0.1" not in result
    assert "localhost" not in result
    assert "192.168.1.5" not in result


def test_filter_allowed_domains_empty_list():
    assert _filter_allowed_domains([]) == []


def test_filter_allowed_domains_non_list():
    assert _filter_allowed_domains("github.com") == []
    assert _filter_allowed_domains(None) == []


def test_filter_allowed_domains_no_duplicates():
    repeated = ["github.com", "github.com", "github.com"]
    result = _filter_allowed_domains(repeated)
    assert result.count("github.com") == 1


# ---------------------------------------------------------------------------
# _build_task_file
# ---------------------------------------------------------------------------


def test_build_task_file(tmp_path):
    payload = {
        "task_id": "task-123",
        "task_title": "Fix the bug",
        "task_description": "There is a bug that needs fixing.",
        "assigned_role_definition_label": "Senior Engineer",
        "llm_model": "gpt-4",
    }
    task_file = _build_task_file(tmp_path, payload)
    assert task_file.exists()
    content = task_file.read_text(encoding="utf-8")
    assert "task-123" in content
    assert "Fix the bug" in content
    assert "There is a bug that needs fixing." in content


def test_build_task_file_creates_directory(tmp_path):
    workspace = tmp_path / "deep" / "nested" / "workspace"
    payload = {
        "task_id": "t-1",
        "task_title": "Title",
        "task_description": "Desc",
    }
    task_file = _build_task_file(workspace, payload)
    assert task_file.is_file()


def test_build_task_file_includes_acceptance_criteria(tmp_path):
    payload = {
        "task_id": "t-2",
        "task_title": "Title",
        "task_description": "Desc",
        "acceptance_criteria": ["Tests pass", "No regressions"],
    }
    content = _build_task_file(tmp_path, payload).read_text(encoding="utf-8")
    assert "Tests pass" in content
    assert "No regressions" in content


def test_build_task_file_includes_operator_guidance(tmp_path):
    payload = {
        "task_id": "t-3",
        "task_title": "Title",
        "task_description": "Desc",
        "metadata": {
            "operator_guidance": [
                {"actor": "operator", "content": "Be careful with prod"},
            ]
        },
    }
    content = _build_task_file(tmp_path, payload).read_text(encoding="utf-8")
    assert "Be careful with prod" in content


def test_build_task_file_mentions_commit_and_push(tmp_path):
    payload = {
        "task_id": "t-4",
        "task_title": "Title",
        "task_description": "Desc",
    }
    content = _build_task_file(tmp_path, payload).read_text(encoding="utf-8")
    assert "Commit your changes and push the prepared branch" in content


def test_is_safe_git_clone_url_rejects_ext_transport():
    assert _is_safe_git_clone_url("ext::sh -c evil") is False


def test_is_safe_git_clone_url_accepts_github_https():
    assert _is_safe_git_clone_url("https://github.com/wan0net/yeet2.git") is True


def test_clone_url_with_credentials_injects_github_token(monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", "ghp_abcdefghijklmnopqrstuvwxyz")
    url = _clone_url_with_credentials("https://github.com/wan0net/yeet2.git")
    assert url.startswith("https://x-access-token:ghp_abcdefghijklmnopqrstuvwxyz@github.com/")


def test_clone_url_with_credentials_leaves_non_github_urls(monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", "ghp_abcdefghijklmnopqrstuvwxyz")
    assert _clone_url_with_credentials("https://git.example.com/org/repo.git") == "https://git.example.com/org/repo.git"


# ---------------------------------------------------------------------------
# _summarize_jsonl_output
# ---------------------------------------------------------------------------


def test_summarize_jsonl_output_empty(tmp_path):
    log = tmp_path / "empty.log"
    log.write_text("", encoding="utf-8")
    result = _summarize_jsonl_output(log, exit_code=0)
    assert "exit_code=0" in result
    assert "completed successfully" in result


def test_summarize_jsonl_output_failure_exit_code(tmp_path):
    log = tmp_path / "fail.log"
    log.write_text("", encoding="utf-8")
    result = _summarize_jsonl_output(log, exit_code=1)
    assert "exit_code=1" in result
    assert "failed" in result


def test_summarize_jsonl_output_with_events(tmp_path):
    log = tmp_path / "events.log"
    lines = [
        json.dumps({"action": "write", "path": "/tmp/foo.py"}),
        json.dumps({"action": "write", "path": "/tmp/bar.py"}),
        json.dumps({"action": "read", "path": "/tmp/baz.py"}),
    ]
    log.write_text("\n".join(lines) + "\n", encoding="utf-8")
    result = _summarize_jsonl_output(log, exit_code=0)
    assert "events=3" in result
    assert "write=2" in result


def test_summarize_jsonl_output_error_on_failure(tmp_path):
    log = tmp_path / "err.log"
    error_event = json.dumps({"type": "error", "content": "Something went wrong"})
    log.write_text(error_event + "\n", encoding="utf-8")
    result = _summarize_jsonl_output(log, exit_code=1)
    assert "Something went wrong" in result


# ---------------------------------------------------------------------------
# JobRecord
# ---------------------------------------------------------------------------


def test_job_record_to_dict():
    record = JobRecord(
        id="job-1",
        task_id="task-1",
        status="running",
        executor_type="openhands",
        workspace_path="/tmp/ws",
        branch_name="yeet2/task-1-branch",
        log_path="/tmp/job-1.log",
        artifact_summary=None,
        started_at="2024-01-01T00:00:00+00:00",
        completed_at=None,
    )
    d = record.to_dict()
    for key in [
        "id",
        "task_id",
        "status",
        "executor_type",
        "workspace_path",
        "branch_name",
        "log_path",
        "artifact_summary",
        "started_at",
        "completed_at",
    ]:
        assert key in d, f"Expected key '{key}' in to_dict() result"


def test_job_record_to_dict_values():
    record = JobRecord(
        id="j",
        task_id="t",
        status="complete",
        executor_type="openhands",
        workspace_path="/ws",
        branch_name="yeet2/t-branch",
        log_path="/log",
        artifact_summary="done",
        started_at="2024-01-01T00:00:00+00:00",
        completed_at="2024-01-01T01:00:00+00:00",
    )
    d = record.to_dict()
    assert d["id"] == "j"
    assert d["status"] == "complete"
    assert d["artifact_summary"] == "done"


# ---------------------------------------------------------------------------
# OpenHandsAdapter.create_job
# ---------------------------------------------------------------------------


def test_create_job_sets_running_status(tmp_path):
    adapter = OpenHandsAdapter(base_dir=tmp_path)
    record = adapter.create_job(
        task_id="test-task",
        payload={
            "task_title": "My Task",
            "task_description": "Do the thing",
            "repo_path": "/tmp/repo",
            "base_branch": "main",
        },
    )
    assert record.status == "running"


def test_create_job_branch_name_format(tmp_path):
    adapter = OpenHandsAdapter(base_dir=tmp_path)
    record = adapter.create_job(
        task_id="abc-123",
        payload={
            "task_title": "My Feature",
            "task_description": "Implement feature",
            "repo_path": "/tmp/repo",
            "base_branch": "main",
        },
    )
    assert record.branch_name.startswith("yeet2/")


def test_create_job_stores_task_id(tmp_path):
    adapter = OpenHandsAdapter(base_dir=tmp_path)
    record = adapter.create_job(
        task_id="xyz-789",
        payload={
            "task_title": "Task",
            "task_description": "Description",
            "repo_path": "/tmp/repo",
            "base_branch": "main",
        },
    )
    assert record.task_id == "xyz-789"


def test_create_job_writes_log_file(tmp_path):
    adapter = OpenHandsAdapter(base_dir=tmp_path)
    record = adapter.create_job(
        task_id="log-task",
        payload={
            "task_title": "Log Test",
            "task_description": "Check the log",
            "repo_path": "/tmp/repo",
            "base_branch": "main",
        },
    )
    assert Path(record.log_path).exists()


# ---------------------------------------------------------------------------
# OpenHandsAdapter._cleanup_worktree
# ---------------------------------------------------------------------------


def test_cleanup_worktree_skipped_on_failure(tmp_path, monkeypatch):
    """When cleanup policy is 'on_success' and status is not 'complete',
    _run_git must not be called."""
    monkeypatch.setenv("YEET2_EXECUTOR_WORKTREE_CLEANUP", "on_success")

    adapter = OpenHandsAdapter(base_dir=tmp_path)

    log = tmp_path / "test.log"
    log.write_text("", encoding="utf-8")

    record = JobRecord(
        id="job-fail",
        task_id="t-fail",
        status="failed",
        executor_type="openhands",
        workspace_path=str(tmp_path / "ws"),
        branch_name="yeet2/t-fail-branch",
        log_path=str(log),
        artifact_summary=None,
        started_at="2024-01-01T00:00:00+00:00",
        completed_at=None,
        payload={"repo_path": "/tmp/repo"},
    )

    with patch("yeet2_executor.adapters._run_git") as mock_git:
        adapter._cleanup_worktree(record, status="failed")
        mock_git.assert_not_called()


def test_cleanup_worktree_runs_on_success(tmp_path, monkeypatch):
    """When cleanup policy is 'on_success' and status is 'complete',
    _run_git must be called once for worktree removal."""
    monkeypatch.setenv("YEET2_EXECUTOR_WORKTREE_CLEANUP", "on_success")

    adapter = OpenHandsAdapter(base_dir=tmp_path)

    log = tmp_path / "test.log"
    log.write_text("", encoding="utf-8")

    record = JobRecord(
        id="job-ok",
        task_id="t-ok",
        status="complete",
        executor_type="openhands",
        workspace_path=str(tmp_path / "ws"),
        branch_name="yeet2/t-ok-branch",
        log_path=str(log),
        artifact_summary="done",
        started_at="2024-01-01T00:00:00+00:00",
        completed_at="2024-01-01T01:00:00+00:00",
        payload={"repo_path": "/tmp/repo"},
    )

    with patch("yeet2_executor.adapters._run_git") as mock_git:
        mock_git.return_value = MagicMock()
        adapter._cleanup_worktree(record, status="complete")
        mock_git.assert_called_once()
        call_args = mock_git.call_args[0][0]
        assert "worktree" in call_args
        assert "remove" in call_args


def test_cleanup_worktree_never_policy(tmp_path, monkeypatch):
    """When cleanup policy is 'never', _run_git must never be called
    regardless of status."""
    monkeypatch.setenv("YEET2_EXECUTOR_WORKTREE_CLEANUP", "never")

    adapter = OpenHandsAdapter(base_dir=tmp_path)

    log = tmp_path / "test.log"
    log.write_text("", encoding="utf-8")

    record = JobRecord(
        id="job-never",
        task_id="t-never",
        status="complete",
        executor_type="openhands",
        workspace_path=str(tmp_path / "ws"),
        branch_name="yeet2/t-never-branch",
        log_path=str(log),
        artifact_summary="done",
        started_at="2024-01-01T00:00:00+00:00",
        completed_at=None,
        payload={"repo_path": "/tmp/repo"},
    )

    with patch("yeet2_executor.adapters._run_git") as mock_git:
        adapter._cleanup_worktree(record, status="complete")
        mock_git.assert_not_called()


# ---------------------------------------------------------------------------
# _summarize_jsonl_output — structured JSON behavior
# ---------------------------------------------------------------------------


def test_summarize_jsonl_output_returns_valid_json(tmp_path):
    """Return value must always be valid JSON."""
    log = tmp_path / "log.log"
    log.write_text("", encoding="utf-8")
    raw = _summarize_jsonl_output(log, exit_code=0)
    parsed = json.loads(raw)
    assert isinstance(parsed, dict)


def test_summarize_jsonl_output_build_status_pass_on_zero(tmp_path):
    """exit_code=0 yields buildStatus='pass'."""
    log = tmp_path / "log.log"
    log.write_text("", encoding="utf-8")
    artifact = json.loads(_summarize_jsonl_output(log, exit_code=0))
    assert artifact["buildStatus"] == "pass"


def test_summarize_jsonl_output_build_status_fail_on_nonzero(tmp_path):
    """exit_code!=0 yields buildStatus='fail'."""
    log = tmp_path / "log.log"
    log.write_text("", encoding="utf-8")
    artifact = json.loads(_summarize_jsonl_output(log, exit_code=2))
    assert artifact["buildStatus"] == "fail"


def test_summarize_jsonl_output_required_keys(tmp_path):
    """Artifact always has summary, handoffNote, buildStatus, diffSummary, testOutput."""
    log = tmp_path / "log.log"
    log.write_text("", encoding="utf-8")
    artifact = json.loads(_summarize_jsonl_output(log, exit_code=0))
    for key in ("summary", "handoffNote", "buildStatus", "diffSummary", "testOutput"):
        assert key in artifact, f"Missing key: {key}"


def test_summarize_jsonl_output_diff_summary_lists_written_paths(tmp_path):
    """Files mentioned in 'path' fields appear in diffSummary."""
    log = tmp_path / "log.log"
    lines = [
        json.dumps({"action": "write", "path": "/repo/src/main.py"}),
        json.dumps({"action": "write", "path": "/repo/tests/test_main.py"}),
    ]
    log.write_text("\n".join(lines) + "\n", encoding="utf-8")
    artifact = json.loads(_summarize_jsonl_output(log, exit_code=0))
    assert "/repo/src/main.py" in artifact["diffSummary"]
    assert "/repo/tests/test_main.py" in artifact["diffSummary"]


def test_summarize_jsonl_output_test_output_parsed_from_pytest_style(tmp_path):
    """testOutput is populated when pytest-style '5 passed, 2 failed' appears in content."""
    log = tmp_path / "log.log"
    event = json.dumps({"action": "run", "content": "===== 5 passed, 2 failed in 1.23s ====="})
    log.write_text(event + "\n", encoding="utf-8")
    artifact = json.loads(_summarize_jsonl_output(log, exit_code=1))
    assert artifact["testOutput"] is not None
    assert artifact["testOutput"]["passed"] == 5
    assert artifact["testOutput"]["failed"] == 2
    assert artifact["testOutput"]["total"] == 7


def test_summarize_jsonl_output_test_output_none_when_no_tests(tmp_path):
    """testOutput is None when no test result data appears in the log."""
    log = tmp_path / "log.log"
    log.write_text(json.dumps({"action": "write", "path": "/f"}) + "\n", encoding="utf-8")
    artifact = json.loads(_summarize_jsonl_output(log, exit_code=0))
    assert artifact["testOutput"] is None


def test_summarize_jsonl_output_malformed_lines_skipped(tmp_path):
    """Lines that are not valid JSON or are non-dict payloads are silently skipped."""
    log = tmp_path / "log.log"
    log.write_text(
        "not json at all\n"
        '{"action": "write", "path": "/ok.py"}\n'
        "{broken json\n",
        encoding="utf-8",
    )
    artifact = json.loads(_summarize_jsonl_output(log, exit_code=0))
    assert "/ok.py" in artifact["diffSummary"]


def test_summarize_jsonl_output_error_in_handoff_note_on_failure(tmp_path):
    """When an error event is present and exit_code!=0, handoffNote contains the error."""
    log = tmp_path / "log.log"
    error_line = json.dumps({"type": "error", "content": "Permission denied"})
    log.write_text(error_line + "\n", encoding="utf-8")
    artifact = json.loads(_summarize_jsonl_output(log, exit_code=1))
    assert "Permission denied" in artifact["handoffNote"]


def test_summarize_jsonl_output_diff_summary_limited_to_ten(tmp_path):
    """diffSummary is capped at 10 entries even if more paths appear."""
    log = tmp_path / "log.log"
    lines = [json.dumps({"action": "write", "path": f"/file{i}.py"}) for i in range(15)]
    log.write_text("\n".join(lines) + "\n", encoding="utf-8")
    artifact = json.loads(_summarize_jsonl_output(log, exit_code=0))
    assert len(artifact["diffSummary"]) <= 10


# ---------------------------------------------------------------------------
# _make_openai_client (executor)
# ---------------------------------------------------------------------------


def test_make_openai_client_executor_uses_langfuse_when_keys_present(monkeypatch):
    """When LANGFUSE keys are set and langfuse.openai is importable, it is used."""
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "pk-exec")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "sk-exec")

    fake_client = MagicMock(name="LangfuseClient")
    fake_langfuse_openai = MagicMock()
    fake_langfuse_openai.OpenAI.return_value = fake_client

    with patch.dict(sys.modules, {"langfuse": MagicMock(), "langfuse.openai": fake_langfuse_openai}):
        client = _make_openai_client("api-key", "https://api.example.com")

    assert client is fake_client
    fake_langfuse_openai.OpenAI.assert_called_once_with(api_key="api-key", base_url="https://api.example.com")


def test_make_openai_client_executor_uses_plain_openai_when_no_keys(monkeypatch):
    """When LANGFUSE keys are absent, openai.OpenAI is returned directly."""
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)

    fake_client = MagicMock(name="PlainOpenAI")
    fake_openai = MagicMock()
    fake_openai.OpenAI.return_value = fake_client

    with patch.dict(sys.modules, {"openai": fake_openai}):
        client = _make_openai_client("api-key", "https://api.example.com")

    assert client is fake_client
    fake_openai.OpenAI.assert_called_once_with(api_key="api-key", base_url="https://api.example.com")
