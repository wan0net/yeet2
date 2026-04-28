"""Tests for yeet2_executor.state."""

from __future__ import annotations

import pytest

from yeet2_executor.state import (
    WorkerRegistryClient,
    _normalize_api_base_url,
    _split_capabilities,
)


# ---------------------------------------------------------------------------
# _split_capabilities
# ---------------------------------------------------------------------------


def test_split_capabilities_csv():
    result = _split_capabilities("local,docker")
    assert result == ["local", "docker"]


def test_split_capabilities_json():
    result = _split_capabilities('["local","docker"]')
    assert result == ["local", "docker"]


def test_split_capabilities_empty():
    assert _split_capabilities("") == []
    assert _split_capabilities(None) == []


def test_split_capabilities_single():
    assert _split_capabilities("local") == ["local"]


def test_split_capabilities_json_strips_whitespace():
    result = _split_capabilities('["local", " docker "]')
    assert result == ["local", "docker"]


def test_split_capabilities_csv_strips_whitespace():
    result = _split_capabilities("local, docker , k8s")
    assert result == ["local", "docker", "k8s"]


# ---------------------------------------------------------------------------
# _normalize_api_base_url
# ---------------------------------------------------------------------------


def test_normalize_api_base_url_valid():
    assert _normalize_api_base_url("http://localhost:3001") == "http://localhost:3001"


def test_normalize_api_base_url_strips_trailing_slash():
    assert _normalize_api_base_url("http://localhost:3001/") == "http://localhost:3001"


def test_normalize_api_base_url_with_path():
    result = _normalize_api_base_url("http://localhost:3001/api/v1/")
    assert result == "http://localhost:3001/api/v1"


def test_normalize_api_base_url_https():
    result = _normalize_api_base_url("https://api.example.com")
    assert result == "https://api.example.com"


def test_normalize_api_base_url_rejects_non_http():
    with pytest.raises(ValueError, match="http or https"):
        _normalize_api_base_url("ftp://example.com")


def test_normalize_api_base_url_rejects_missing_host():
    with pytest.raises(ValueError, match="host"):
        _normalize_api_base_url("http://")


def test_normalize_api_base_url_rejects_credentials():
    with pytest.raises(ValueError, match="credentials"):
        _normalize_api_base_url("http://user:pass@host")


def test_normalize_api_base_url_rejects_bare_username():
    with pytest.raises(ValueError, match="credentials"):
        _normalize_api_base_url("http://user@host")


# ---------------------------------------------------------------------------
# WorkerRegistryClient.from_env
# ---------------------------------------------------------------------------


_REGISTRY_ENV_VARS = [
    "YEET2_EXECUTOR_WORKER_ID",
    "YEET2_EXECUTOR_WORKER_NAME",
    "YEET2_EXECUTOR_WORKER_EXECUTOR_TYPE",
    "YEET2_EXECUTOR_WORKER_HOST",
    "YEET2_EXECUTOR_WORKER_ENDPOINT",
    "YEET2_EXECUTOR_API_BASE_URL",
    "YEET2_API_BASE_URL",
    "API_BASE_URL",
    "YEET2_EXECUTOR_WORKER_CAPABILITIES",
    "YEET2_EXECUTOR_MODE",
]


def test_worker_registry_client_from_env_defaults(monkeypatch):
    """With no relevant env vars, from_env should produce a client with
    sensible hostname-based defaults and not raise."""
    for var in _REGISTRY_ENV_VARS:
        monkeypatch.delenv(var, raising=False)

    client = WorkerRegistryClient.from_env()

    assert isinstance(client, WorkerRegistryClient)
    assert client.api_base_url == "http://127.0.0.1:3001"
    # worker_id defaults to worker_name or hostname — must be non-empty
    assert client.worker_id
    # executor_type falls back to "local"
    assert client.executor_type == "local"
    # capabilities include the local/git baseline and executor type
    assert client.capabilities == ["local", "git"]


def test_worker_registry_client_defaults_executor_type_from_executor_mode(monkeypatch):
    for var in _REGISTRY_ENV_VARS:
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("YEET2_EXECUTOR_MODE", "codex")

    client = WorkerRegistryClient.from_env()

    assert client.executor_type == "codex"
    assert client.capabilities == ["local", "git", "codex"]


def test_worker_registry_client_from_env_custom_values(monkeypatch):
    """Explicitly set env vars must be reflected in the created client."""
    for var in _REGISTRY_ENV_VARS:
        monkeypatch.delenv(var, raising=False)

    monkeypatch.setenv("YEET2_EXECUTOR_WORKER_ID", "worker-42")
    monkeypatch.setenv("YEET2_EXECUTOR_WORKER_NAME", "my-worker")
    monkeypatch.setenv("YEET2_EXECUTOR_WORKER_EXECUTOR_TYPE", "docker")
    monkeypatch.setenv("YEET2_EXECUTOR_API_BASE_URL", "http://api.internal:4000")
    monkeypatch.setenv("YEET2_EXECUTOR_WORKER_CAPABILITIES", "local,docker")

    client = WorkerRegistryClient.from_env()

    assert client.worker_id == "worker-42"
    assert client.worker_name == "my-worker"
    assert client.executor_type == "docker"
    assert client.api_base_url == "http://api.internal:4000"
    assert set(client.capabilities) == {"local", "docker"}


def test_worker_registry_client_from_env_endpoint_none_when_blank(monkeypatch):
    """An empty YEET2_EXECUTOR_WORKER_ENDPOINT must result in endpoint=None."""
    for var in _REGISTRY_ENV_VARS:
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("YEET2_EXECUTOR_WORKER_ENDPOINT", "  ")

    client = WorkerRegistryClient.from_env()
    assert client.endpoint is None


def test_worker_registry_client_from_env_endpoint_set(monkeypatch):
    for var in _REGISTRY_ENV_VARS:
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("YEET2_EXECUTOR_WORKER_ENDPOINT", "http://myworker:8080")

    client = WorkerRegistryClient.from_env()
    assert client.endpoint == "http://myworker:8080"
