"""In-memory execution state for the Executor skeleton."""

from __future__ import annotations

import json
import os
import time
from http.client import HTTPConnection, HTTPSConnection
from urllib.parse import urlparse
from dataclasses import dataclass
from socket import gethostname
from threading import Lock, Thread
from typing import Any

from .adapters import JobRecord, OpenHandsAdapter


def _clean_text(value: str | None) -> str:
    if not value:
        return ""
    return value.strip()


def _split_capabilities(value: str | None) -> list[str]:
    text = _clean_text(value)
    if not text:
        return []
    if text.startswith("["):
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, list):
            return [item.strip() for item in parsed if isinstance(item, str) and item.strip()]
    return [item.strip() for item in text.split(",") if item.strip()]


def _env_text(*names: str, default: str = "") -> str:
    for name in names:
        value = _clean_text(os.getenv(name))
        if value:
            return value
    return default


def _normalize_api_base_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Worker registry API base URL must use http or https")
    if not parsed.netloc:
        raise ValueError("Worker registry API base URL must include a host")
    if parsed.username or parsed.password:
        raise ValueError("Worker registry API base URL must not include credentials")
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path.rstrip('/')}"


@dataclass(slots=True)
class WorkerRegistryClient:
    api_base_url: str
    worker_id: str
    worker_name: str
    executor_type: str
    capabilities: list[str]
    host: str
    endpoint: str | None

    @classmethod
    def from_env(cls) -> "WorkerRegistryClient":
        worker_id = _env_text("YEET2_EXECUTOR_WORKER_ID", default="")
        worker_name = _env_text("YEET2_EXECUTOR_WORKER_NAME", default="")
        executor_type = _env_text("YEET2_EXECUTOR_WORKER_EXECUTOR_TYPE", default="")
        host = _env_text("YEET2_EXECUTOR_WORKER_HOST", default="")
        endpoint = _env_text("YEET2_EXECUTOR_WORKER_ENDPOINT", default="")
        api_base_url = _normalize_api_base_url(
            _env_text(
                "YEET2_EXECUTOR_API_BASE_URL",
                "YEET2_API_BASE_URL",
                "API_BASE_URL",
                default="http://127.0.0.1:3001",
            ),
        )

        resolved_worker_name = worker_name or f"local-worker@{gethostname()}"
        resolved_worker_id = worker_id or resolved_worker_name or gethostname() or "local-worker"
        resolved_executor_type = executor_type or "local"
        resolved_host = host or gethostname()
        capabilities = _split_capabilities(os.getenv("YEET2_EXECUTOR_WORKER_CAPABILITIES"))
        return cls(
            api_base_url=api_base_url,
            worker_id=resolved_worker_id,
            worker_name=resolved_worker_name,
            executor_type=resolved_executor_type,
            capabilities=capabilities or ["local"],
            host=resolved_host,
            endpoint=endpoint or None,
        )

    def _request(self, path: str, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        parsed = urlparse(f"{self.api_base_url}{path}")
        connection_class = HTTPSConnection if parsed.scheme == "https" else HTTPConnection
        request_path = parsed.path or "/"
        if parsed.query:
            request_path = f"{request_path}?{parsed.query}"
        try:
            connection = connection_class(parsed.netloc, timeout=2)
            connection.request(
                "POST",
                request_path,
                body=body,
                headers={"Content-Type": "application/json"},
            )
            response = connection.getresponse()
            response.read()
            connection.close()
            return
        except (TimeoutError, OSError, ValueError):
            return

    def ensure_registered(self) -> None:
        self._request(
            "/workers/register",
            {
                "id": self.worker_id,
                "name": self.worker_name,
                "executorType": self.executor_type,
                "status": "online",
                "capabilities": self.capabilities,
                "host": self.host,
                "endpoint": self.endpoint,
            },
        )

    def heartbeat(self, current_job_id: str | None, *, status: str | None = None) -> None:
        payload: dict[str, Any] = {
            "name": self.worker_name,
            "executorType": self.executor_type,
            "capabilities": self.capabilities,
            "currentJobId": current_job_id,
            "host": self.host,
            "endpoint": self.endpoint,
        }
        if status:
            payload["status"] = status
        self._request(f"/workers/{self.worker_id}/heartbeat", payload)

    def job_payload(self) -> dict[str, Any]:
        return {
            "worker_id": self.worker_id,
        }


class JobStore:
    def __init__(self) -> None:
        self._adapter = OpenHandsAdapter()
        self._worker_registry = WorkerRegistryClient.from_env()
        self._lock = Lock()
        self._jobs: dict[str, JobRecord] = {}
        self._worker_registry.ensure_registered()
        self._worker_registry.heartbeat(None, status="online")

        self._current_job_id: str | None = None
        self._stopping = False
        heartbeat_seconds = 30
        raw = os.getenv("YEET2_EXECUTOR_HEARTBEAT_INTERVAL_SECONDS", "").strip()
        if raw:
            try:
                heartbeat_seconds = max(5, int(raw))
            except ValueError:
                pass
        self._heartbeat_interval = heartbeat_seconds
        self._heartbeat_thread = Thread(target=self._heartbeat_loop, daemon=True)
        self._heartbeat_thread.start()

    def submit_job(self, task_id: str, payload: dict[str, Any]) -> JobRecord:
        job_payload = dict(payload)
        job_payload.update(self._worker_registry.job_payload())
        job = self._adapter.create_job(task_id=task_id, payload=job_payload)
        with self._lock:
            self._jobs[job.id] = job

        self._worker_registry.ensure_registered()
        self._current_job_id = job.id
        self._worker_registry.heartbeat(job.id, status="busy")
        try:
            return self._adapter.run_job(job)
        finally:
            self._current_job_id = None
            self._worker_registry.heartbeat(None, status="online")

    def get(self, job_id: str) -> JobRecord | None:
        with self._lock:
            return self._jobs.get(job_id)

    def _heartbeat_loop(self) -> None:
        while not self._stopping:
            time.sleep(self._heartbeat_interval)
            if self._stopping:
                break
            try:
                status = "busy" if self._current_job_id else "online"
                self._worker_registry.heartbeat(self._current_job_id, status=status)
            except Exception:  # noqa: BLE001
                pass

    def shutdown(self) -> None:
        self._stopping = True
