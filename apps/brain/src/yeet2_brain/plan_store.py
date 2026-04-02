"""In-memory store for planning runs and results."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from .planner import PlanningInput, PlanningResult
from .roles import Role


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(slots=True)
class OrchestrationRun:
    id: str
    project_id: str
    status: str
    requested_by: str
    roles: list[str]
    created_at: str
    updated_at: str
    input: dict[str, Any] = field(default_factory=dict)
    result: dict[str, Any] | None = None


class RunStore:
    def __init__(self) -> None:
        self._runs: dict[str, OrchestrationRun] = {}

    def create_planning_run(
        self,
        planning_input: PlanningInput,
        planning_result: PlanningResult,
    ) -> OrchestrationRun:
        run = OrchestrationRun(
            id=str(uuid4()),
            project_id=planning_input.project_id,
            status="completed",
            requested_by=planning_input.requested_by,
            roles=[role.value for role in Role],
            created_at=_utc_now(),
            updated_at=_utc_now(),
            input={
                "project_name": planning_input.project_name,
                "constitution": {
                    key: section.text
                    for key, section in planning_input.constitution.items()
                    if section.text.strip()
                },
                "raw_payload": planning_input.raw_payload,
            },
            result={
                "mission": asdict(planning_result.mission),
                "tasks": [asdict(task) for task in planning_result.tasks],
                "themes": planning_result.themes,
                "summary": planning_result.summary,
            },
        )
        self._runs[run.id] = run
        return run

    def get(self, run_id: str) -> OrchestrationRun | None:
        return self._runs.get(run_id)

