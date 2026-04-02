"""In-memory execution state for the Executor skeleton."""

from __future__ import annotations

from threading import Lock
from typing import Any

from .adapters import JobRecord, OpenHandsAdapter


class JobStore:
    def __init__(self) -> None:
        self._adapter = OpenHandsAdapter()
        self._lock = Lock()
        self._jobs: dict[str, JobRecord] = {}

    def submit_job(self, task_id: str, payload: dict[str, Any]) -> JobRecord:
        job = self._adapter.create_job(task_id=task_id, payload=payload)
        with self._lock:
            self._jobs[job.id] = job
        return self._adapter.run_job(job)

    def get(self, job_id: str) -> JobRecord | None:
        with self._lock:
            return self._jobs.get(job_id)
