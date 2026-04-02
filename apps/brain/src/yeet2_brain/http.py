"""HTTP handler for the Brain planning service."""

from __future__ import annotations

import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from .planner import ConstitutionSection, PlanningInput, plan_project
from .plan_store import RunStore


def _clean_text(value: object) -> str:
    if isinstance(value, str):
        return value.strip()
    if value is None:
        return ""
    if isinstance(value, dict):
        for key in ("content", "text", "summary", "body", "markdown", "value"):
            nested = _clean_text(value.get(key))
            if nested:
                return nested
    return ""


def _section_from_payload(title: str, payload: object) -> ConstitutionSection:
    return ConstitutionSection(title=title, text=_clean_text(payload))


def _extract_constitution(payload: dict[str, object]) -> dict[str, ConstitutionSection]:
    source = payload.get("constitution")
    if not isinstance(source, dict):
        source = {}

    files = payload.get("constitution_files")
    if not isinstance(files, dict):
        files = {}

    def read(key: str, *aliases: str) -> ConstitutionSection:
        candidates = [key, *aliases]
        for candidate in candidates:
            if candidate in source:
                return _section_from_payload(candidate, source.get(candidate))
            if candidate in files:
                return _section_from_payload(candidate, files.get(candidate))
        return ConstitutionSection(title=key, text="")

    return {
        "vision": read("vision", "vision_path", "vision_text", "vision_summary"),
        "spec": read("spec", "spec_path", "spec_text", "spec_summary"),
        "roadmap": read("roadmap", "roadmap_path", "roadmap_text", "roadmap_summary"),
        "architecture": read("architecture", "architecture_path", "architecture_text", "architecture_summary"),
        "decisions": read("decisions", "decisions_path", "decisions_text", "decisions_summary"),
        "qualityBar": read("qualityBar", "quality_bar_path", "quality_bar_text", "quality_bar_summary"),
    }


class BrainApp:
    def __init__(self) -> None:
        self.store = RunStore()

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
                    self._send_json(HTTPStatus.OK, {"status": "ok", "service": "brain"})
                    return
                if path.startswith("/orchestration/runs/"):
                    run_id = path.rsplit("/", 1)[-1]
                    run = store.get(run_id)
                    if run is None:
                        self._send_json(HTTPStatus.NOT_FOUND, {"error": "run_not_found"})
                        return
                    self._send_json(HTTPStatus.OK, run.__dict__)
                    return
                self._send_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

            def do_POST(self) -> None:  # noqa: N802
                path = urlparse(self.path).path
                if path != "/orchestration/plan":
                    self._send_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
                    return
                length = int(self.headers.get("Content-Length", "0"))
                raw = self.rfile.read(length) if length else b"{}"
                try:
                    payload = json.loads(raw.decode("utf-8"))
                except json.JSONDecodeError:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_json"})
                    return
                project_id = str(payload.get("project_id", "")).strip()
                if not project_id:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": "project_id_required"})
                    return
                project_name = str(payload.get("project_name", "")).strip() or project_id
                planning_input = PlanningInput(
                    project_id=project_id,
                    project_name=project_name,
                    requested_by=str(payload.get("requested_by", "system")).strip() or "system",
                    constitution=_extract_constitution(payload),
                    raw_payload=payload if isinstance(payload, dict) else {},
                )
                planning_result = plan_project(planning_input)
                run = store.create_planning_run(planning_input, planning_result)
                self._send_json(
                    HTTPStatus.OK,
                    {
                        "run": run.__dict__,
                        "mission": run.result["mission"],
                        "tasks": run.result["tasks"],
                        "themes": run.result["themes"],
                        "summary": run.result["summary"],
                    },
                )

            def log_message(self, format: str, *args: object) -> None:  # noqa: A003
                return

        return Handler


def serve(host: str = "0.0.0.0", port: int = 8011) -> None:
    app = BrainApp()
    server = ThreadingHTTPServer((host, port), app.handler_class())
    server.serve_forever()
