"""In-memory execution state for the Executor skeleton."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from socket import gethostname
from threading import Lock
from typing import Any
from urllib import error, request

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
        api_base_url = _env_text("YEET2_EXECUTOR_API_BASE_URL", "YEET2_API_BASE_URL", "API_BASE_URL", default="http://127.0.0.1:3001").rstrip("/")

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
        req = request.Request(
            f"{self.api_base_url}{path}",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=2):
                return
        except (error.HTTPError, error.URLError, TimeoutError, OSError):
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

    def submit_job(self, task_id: str, payload: dict[str, Any]) -> JobRecord:
        job_payload = dict(payload)
        job_payload.update(self._worker_registry.job_payload())
        job = self._adapter.create_job(task_id=task_id, payload=job_payload)
        with self._lock:
            self._jobs[job.id] = job

        self._worker_registry.ensure_registered()
        self._worker_registry.heartbeat(job.id, status="busy")
        try:
            return self._adapter.run_job(job)
        finally:
            self._worker_registry.heartbeat(None, status="online")

    def get(self, job_id: str) -> JobRecord | None:
        with self._lock:
            return self._jobs.get(job_id)
