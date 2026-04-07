"""Security-focused tests for executor: command redaction, env whitelist,
HTTP size limits, and bearer auth."""

from __future__ import annotations

import json
import os
from http import HTTPStatus
from unittest.mock import MagicMock

import pytest

from yeet2_executor.adapters import (
    JobRecord,
    _OPENHANDS_ENV_WHITELIST,
    _build_openhands_env,
    _redact_command,
    _redact_secrets,
)
from yeet2_executor.http import (
    MAX_ACCEPTANCE_CRITERIA_COUNT,
    MAX_ACCEPTANCE_CRITERION_CHARS,
    MAX_REQUEST_BODY_BYTES,
    ExecutorApp,
    _extract_bearer_token,
    _normalize_acceptance_criteria,
)


# ---------------------------------------------------------------------------
# Command + secret redaction
# ---------------------------------------------------------------------------


def test_redact_secrets_removes_openai_key():
    redacted = _redact_secrets("--api-key sk-ABCDEFGHIJKLMNOPQRSTUVWX")
    assert "sk-ABCD" not in redacted
    assert "***" in redacted


def test_redact_secrets_removes_github_pat():
    redacted = _redact_secrets("GITHUB_TOKEN=ghp_0123456789abcdefghij")
    assert "ghp_" not in redacted


def test_redact_secrets_leaves_safe_values_alone():
    assert _redact_secrets("--verbose") == "--verbose"
    assert _redact_secrets("/workspace/project") == "/workspace/project"


def test_redact_command_masks_key_value_pairs():
    command = ["openhands", "OPENAI_API_KEY=sk-realkey123456789012345", "--headless"]
    out = _redact_command(command)
    assert "sk-realkey" not in out
    assert "OPENAI_API_KEY=***" in out
    assert "--headless" in out


def test_redact_command_masks_password_style_env():
    command = ["run", "DATABASE_PASSWORD=supersecret", "--go"]
    out = _redact_command(command)
    assert "supersecret" not in out
    assert "DATABASE_PASSWORD=***" in out


def test_redact_command_preserves_non_secret_env():
    command = ["run", "NODE_ENV=production", "--go"]
    out = _redact_command(command)
    # NODE_ENV is not matched by the secret-key pattern, so the value stays.
    assert "production" in out


# ---------------------------------------------------------------------------
# Environment whitelist
# ---------------------------------------------------------------------------


def test_openhands_env_whitelist_contains_core_vars():
    # These are required for the subprocess to route LLM calls correctly.
    for name in ("LLM_MODEL", "LLM_API_KEY", "OPENROUTER_API_KEY", "PATH", "HOME"):
        assert name in _OPENHANDS_ENV_WHITELIST, f"{name} must be whitelisted"


def _make_job_record(payload: dict | None = None) -> JobRecord:
    return JobRecord(
        id="jid",
        task_id="tid",
        status="queued",
        executor_type="openhands",
        workspace_path="/tmp/ws",
        branch_name="feat/x",
        log_path="/tmp/log.txt",
        artifact_summary=None,
        started_at=None,
        completed_at=None,
        payload=payload or {},
    )


def test_build_openhands_env_strips_unrelated_vars(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("TOTALLY_UNRELATED_SECRET", "leakme")
    monkeypatch.setenv("LLM_MODEL", "gpt-x")
    env = _build_openhands_env(_make_job_record())
    assert "TOTALLY_UNRELATED_SECRET" not in env
    assert env.get("LLM_MODEL") == "gpt-x"
    assert env.get("PYTHONUNBUFFERED") == "1"


def test_build_openhands_env_model_override_takes_precedence(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("LLM_MODEL", "env-model")
    env = _build_openhands_env(_make_job_record({"llm_model": "payload-model"}))
    assert env["LLM_MODEL"] == "payload-model"
    assert env["OPENAI_MODEL_NAME"] == "payload-model"
    assert env["MODEL"] == "payload-model"


# ---------------------------------------------------------------------------
# Acceptance criteria normalization — prompt injection defense
# ---------------------------------------------------------------------------


def test_normalize_acceptance_criteria_accepts_normal_list():
    payload = {"acceptance_criteria": ["first criterion", "second"]}
    assert _normalize_acceptance_criteria(payload) == ["first criterion", "second"]


def test_normalize_acceptance_criteria_rejects_null_bytes():
    payload = {"acceptance_criteria": ["hello\x00world"]}
    with pytest.raises(ValueError):
        _normalize_acceptance_criteria(payload)


def test_normalize_acceptance_criteria_rejects_overlong_item():
    payload = {"acceptance_criteria": ["x" * (MAX_ACCEPTANCE_CRITERION_CHARS + 1)]}
    with pytest.raises(ValueError):
        _normalize_acceptance_criteria(payload)


def test_normalize_acceptance_criteria_rejects_too_many_items():
    payload = {"acceptance_criteria": ["item"] * (MAX_ACCEPTANCE_CRITERIA_COUNT + 1)}
    with pytest.raises(ValueError):
        _normalize_acceptance_criteria(payload)


def test_normalize_acceptance_criteria_rejects_non_string_items():
    payload = {"acceptance_criteria": ["ok", 123]}
    with pytest.raises(ValueError):
        _normalize_acceptance_criteria(payload)


def test_normalize_acceptance_criteria_absent_returns_none():
    assert _normalize_acceptance_criteria({}) is None


# ---------------------------------------------------------------------------
# Bearer token extraction
# ---------------------------------------------------------------------------


def test_extract_bearer_token_returns_token():
    headers = {"Authorization": "Bearer abc123"}
    assert _extract_bearer_token(headers) == "abc123"


def test_extract_bearer_token_is_case_insensitive_on_scheme():
    headers = {"Authorization": "bearer abc123"}
    assert _extract_bearer_token(headers) == "abc123"


def test_extract_bearer_token_returns_none_without_header():
    assert _extract_bearer_token({}) is None


def test_extract_bearer_token_returns_none_for_non_bearer_scheme():
    headers = {"Authorization": "Basic dXNlcjpwYXNz"}
    assert _extract_bearer_token(headers) is None


# ---------------------------------------------------------------------------
# HTTP handler — size limits + bearer auth
# ---------------------------------------------------------------------------


class _FakeHeaders:
    def __init__(self, values: dict[str, str]) -> None:
        self._values = values

    def get(self, key: str, default: str | None = None) -> str | None:
        return self._values.get(key, default)


class _FakeRFile:
    def __init__(self, payload: bytes) -> None:
        self._payload = payload

    def read(self, length: int) -> bytes:
        return self._payload[:length]


def _make_handler(body: bytes, headers: dict[str, str]):
    app = ExecutorApp()
    HandlerCls = app.handler_class()

    # We bypass BaseHTTPRequestHandler's socket setup by constructing the
    # instance lazily and assigning the attributes the methods touch.
    handler = HandlerCls.__new__(HandlerCls)
    handler.headers = _FakeHeaders(headers)
    handler.rfile = _FakeRFile(body)

    sent: dict[str, object] = {}

    def fake_send_json(status, payload):
        sent["status"] = status
        sent["payload"] = payload

    handler._send_json = fake_send_json  # type: ignore[method-assign]
    return handler, sent


def test_read_body_rejects_oversized_content_length():
    handler, sent = _make_handler(b"{}", {"Content-Length": str(MAX_REQUEST_BODY_BYTES + 1)})
    assert handler._read_body() is None
    assert sent["status"] == HTTPStatus.REQUEST_ENTITY_TOO_LARGE
    assert sent["payload"] == {"error": "payload_too_large"}


def test_read_body_rejects_negative_content_length():
    handler, sent = _make_handler(b"{}", {"Content-Length": "-5"})
    assert handler._read_body() is None
    assert sent["status"] == HTTPStatus.REQUEST_ENTITY_TOO_LARGE


def test_read_body_rejects_non_numeric_content_length():
    handler, sent = _make_handler(b"{}", {"Content-Length": "abc"})
    assert handler._read_body() is None
    assert sent["status"] == HTTPStatus.BAD_REQUEST


def test_read_body_returns_payload_for_valid_size():
    payload = b'{"ok": true}'
    handler, sent = _make_handler(payload, {"Content-Length": str(len(payload))})
    assert handler._read_body() == payload
    assert sent == {}


def test_require_auth_passes_when_no_token_configured(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("YEET2_EXECUTOR_BEARER_TOKEN", raising=False)
    handler, sent = _make_handler(b"{}", {})
    assert handler._require_auth() is True
    assert sent == {}


def test_require_auth_rejects_missing_token_when_configured(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("YEET2_EXECUTOR_BEARER_TOKEN", "s" * 40)
    handler, sent = _make_handler(b"{}", {})
    assert handler._require_auth() is False
    assert sent["status"] == HTTPStatus.UNAUTHORIZED


def test_require_auth_accepts_correct_token(monkeypatch: pytest.MonkeyPatch):
    token = "t" * 40
    monkeypatch.setenv("YEET2_EXECUTOR_BEARER_TOKEN", token)
    handler, sent = _make_handler(b"{}", {"Authorization": f"Bearer {token}"})
    assert handler._require_auth() is True
    assert sent == {}


def test_require_auth_rejects_wrong_token(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("YEET2_EXECUTOR_BEARER_TOKEN", "u" * 40)
    handler, sent = _make_handler(b"{}", {"Authorization": f"Bearer {'v' * 40}"})
    assert handler._require_auth() is False
    assert sent["status"] == HTTPStatus.UNAUTHORIZED
