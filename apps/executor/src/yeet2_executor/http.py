"""HTTP handler for the Executor skeleton."""

from __future__ import annotations

import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
from typing import Any

from .state import JobStore


def _require_text(payload: dict[str, Any], field: str) -> str:
    value = payload.get(field)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(field)
    return value.strip()


def _normalize_acceptance_criteria(payload: dict[str, Any]) -> list[str] | None:
    if "acceptance_criteria" not in payload or payload["acceptance_criteria"] is None:
        return None
    value = payload["acceptance_criteria"]
    if not isinstance(value, list):
        raise ValueError("acceptance_criteria")
    criteria: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise ValueError("acceptance_criteria")
        criteria.append(item.strip())
    return criteria


class ExecutorApp:
    def __init__(self) -> None:
        self.store = JobStore()

    def handler_class(self) -> type[BaseHTTPRequestHandler]:
        store = self.store

        class Handler(BaseHTTPRequestHandler):
            def _send_json(self, status: HTTPStatus, payload: dict) -> None:
                body = json.dumps(payload).encode("utf-8")
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self) -> None:  # noqa: N802
                path = urlparse(self.path).path
                if path == "/health":
                    self._send_json(HTTPStatus.OK, {"status": "ok", "service": "executor"})
                    return
                if path.startswith("/jobs/"):
                    job_id = path.rsplit("/", 1)[-1]
                    job = store.get(job_id)
                    if job is None:
                        self._send_json(HTTPStatus.NOT_FOUND, {"error": "job_not_found"})
                        return
                    self._send_json(HTTPStatus.OK, job.to_dict())
                    return
                self._send_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

            def do_POST(self) -> None:  # noqa: N802
                path = urlparse(self.path).path
                if path != "/jobs":
                    self._send_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
                    return
                length = int(self.headers.get("Content-Length", "0"))
                raw = self.rfile.read(length) if length else b"{}"
                try:
                    payload = json.loads(raw.decode("utf-8"))
                except json.JSONDecodeError:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_json"})
                    return
                if not isinstance(payload, dict):
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_payload"})
                    return
                try:
                    task_id = _require_text(payload, "task_id")
                    task_title = _require_text(payload, "task_title")
                    task_description = _require_text(payload, "task_description")
                    acceptance_criteria = _normalize_acceptance_criteria(payload)
                    # Only require repo_path/base_branch for non-passthrough adapters
                    adapter = str(payload.get("adapter", "")).strip().lower()
                    if adapter != "passthrough":
                        repo_path = _require_text(payload, "repo_path")
                        base_branch = _require_text(payload, "base_branch")
                    else:
                        repo_path = str(payload.get("repo_path", "")).strip()
                        base_branch = str(payload.get("base_branch", "")).strip()
                except ValueError as exc:
                    self._send_json(
                        HTTPStatus.BAD_REQUEST,
                        {"error": "invalid_request", "field": str(exc)},
                    )
                    return
                normalized_payload = dict(payload)
                normalized_payload.update(
                    {
                        "task_id": task_id,
                        "repo_path": repo_path,
                        "base_branch": base_branch,
                        "task_title": task_title,
                        "task_description": task_description,
                    }
                )
                if acceptance_criteria is not None:
                    normalized_payload["acceptance_criteria"] = acceptance_criteria
                elif "acceptance_criteria" in normalized_payload:
                    normalized_payload.pop("acceptance_criteria")
                job = store.submit_job(task_id=task_id, payload=normalized_payload)
                self._send_json(HTTPStatus.ACCEPTED, job.to_dict())

            def log_message(self, format: str, *args: object) -> None:  # noqa: A003
                return

        return Handler


def serve(host: str = "0.0.0.0", port: int = 8021) -> None:
    app = ExecutorApp()
    server = ThreadingHTTPServer((host, port), app.handler_class())
    server.serve_forever()
