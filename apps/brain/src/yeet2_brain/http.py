"""HTTP handler for the Brain planning service."""

from __future__ import annotations

import json
import os
from dataclasses import asdict
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from .planner import ConstitutionSection, PlanningInput, plan_project
from .roles import PlanningRoleDefinition, normalize_planning_role_definitions
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


def _env_text(name: str) -> str:
    return os.getenv(name, "").strip()


def _env_int(name: str) -> int | None:
    raw = _env_text(name)
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def _resolve_bind(host: str | None, port: int | None) -> tuple[str, int]:
    bind_host = host or _env_text("YEET2_HOST") or _env_text("BRAIN_HOST") or _env_text("HOST")
    if not bind_host:
        bind_host = "0.0.0.0"

    bind_port = port
    if bind_port is None:
        for env_name in ("BRAIN_PORT", "YEET2_BRAIN_PORT", "PORT", "YEET2_PORT"):
            env_port = _env_int(env_name)
            if env_port is not None:
                bind_port = env_port
                break
    if bind_port is None:
        bind_port = 8011

    return bind_host, bind_port


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


def _extract_role_definitions(payload: dict[str, object]) -> tuple[list[PlanningRoleDefinition], bool]:
    for key in ("role_definitions", "roleDefinitions", "roles"):
        if key in payload:
            value = payload.get(key)
            if isinstance(value, list):
                return normalize_planning_role_definitions(value), True
            return [], True
    return [], False


def _serialize_mission(mission: object) -> dict[str, object]:
    data = asdict(mission)
    return {
        "id": data.get("id"),
        "projectId": data.get("project_id"),
        "title": data.get("title"),
        "objective": data.get("objective"),
        "status": data.get("status"),
        "createdBy": data.get("created_by"),
        "startedAt": data.get("started_at"),
        "completedAt": data.get("completed_at"),
    }


def _serialize_task(task: object) -> dict[str, object]:
    data = asdict(task)
    return {
        "id": data.get("id"),
        "title": data.get("title"),
        "description": data.get("description"),
        "agentRole": data.get("agent_role"),
        "status": data.get("status"),
        "priority": data.get("priority"),
        "acceptanceCriteria": data.get("acceptance_criteria"),
        "attempts": data.get("attempts"),
        "blockerReason": data.get("blocker_reason"),
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
                    self._send_json(HTTPStatus.OK, asdict(run))
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
                role_definitions, role_definitions_provided = _extract_role_definitions(payload)
                if role_definitions_provided and not any(definition.enabled for definition in role_definitions):
                    self._send_json(
                        HTTPStatus.BAD_REQUEST,
                        {
                            "error": "invalid_role_definitions",
                            "message": "At least one enabled role definition is required",
                        },
                    )
                    return
                planning_input = PlanningInput(
                    project_id=project_id,
                    project_name=project_name,
                    requested_by=str(payload.get("requested_by", "system")).strip() or "system",
                    constitution=_extract_constitution(payload),
                    role_definitions=role_definitions,
                    raw_payload=payload if isinstance(payload, dict) else {},
                )
                try:
                    planning_result = plan_project(planning_input)
                except Exception:
                    self._send_json(
                        HTTPStatus.SERVICE_UNAVAILABLE,
                        {"error": "planning_failed", "message": "Brain planning failed"},
                    )
                    return
                run = store.create_planning_run(planning_input, planning_result)
                if isinstance(run.result, dict):
                    run.result["source"] = planning_result.source
                self._send_json(
                    HTTPStatus.OK,
                    {
                        "run": asdict(run),
                        "source": planning_result.source,
                        "mission": _serialize_mission(planning_result.mission),
                        "tasks": [_serialize_task(task) for task in planning_result.tasks],
                        "themes": run.result["themes"],
                        "summary": run.result["summary"],
                    },
                )

            def log_message(self, format: str, *args: object) -> None:  # noqa: A003
                return

        return Handler


def serve(host: str | None = None, port: int | None = None) -> None:
    bind_host, bind_port = _resolve_bind(host, port)
    app = BrainApp()
    server = ThreadingHTTPServer((bind_host, bind_port), app.handler_class())
    server.serve_forever()
