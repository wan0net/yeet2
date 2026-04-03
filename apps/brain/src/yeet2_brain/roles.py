"""Brain orchestration role names."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
import os


class Role(StrEnum):
    PLANNER = "Planner"
    ARCHITECT = "Architect"
    IMPLEMENTER = "Implementer"
    QA = "QA"
    REVIEWER = "Reviewer"
    VISUAL = "Visual"


@dataclass(slots=True)
class PlanningRoleDefinition:
    key: str
    label: str
    goal: str
    backstory: str
    model: str | None = None
    enabled: bool = True
    sort_order: int = 0

def _clean_text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _coerce_bool(value: object, default: bool = True) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "on"}:
            return True
        if normalized in {"0", "false", "no", "off"}:
            return False
    return default


def _coerce_int(value: object, default: int) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(value.strip())
        except ValueError:
            return default
    return default


def _normalize_role_key(value: object) -> str | None:
    if not isinstance(value, str):
        return None

    normalized = value.strip().lower()
    return normalized or None


_ROLE_MODEL_ENV_NAMES = {
    "planner": "YEET2_ROLE_MODEL_DEFAULT_PLANNER",
    "architect": "YEET2_ROLE_MODEL_DEFAULT_ARCHITECT",
    "implementer": "YEET2_ROLE_MODEL_DEFAULT_IMPLEMENTER",
    "qa": "YEET2_ROLE_MODEL_DEFAULT_QA",
    "reviewer": "YEET2_ROLE_MODEL_DEFAULT_REVIEWER",
    "visual": "YEET2_ROLE_MODEL_DEFAULT_VISUAL",
}

_ROLE_MODEL_DEFAULTS = {
    "planner": "openrouter/anthropic/claude-sonnet-4",
    "architect": "openrouter/anthropic/claude-sonnet-4",
    "implementer": "openrouter/openai/gpt-4.1",
    "qa": "openrouter/openai/gpt-4.1-mini",
    "reviewer": "openrouter/anthropic/claude-sonnet-4",
    "visual": "openrouter/google/gemini-2.5-pro",
}


def recommended_model_for_role_key(role_key: str) -> str | None:
    normalized = _normalize_role_key(role_key)
    if not normalized:
        return None

    env_name = _ROLE_MODEL_ENV_NAMES.get(normalized)
    if env_name:
        configured = _clean_text(os.getenv(env_name))
        if configured:
            return configured

    return _ROLE_MODEL_DEFAULTS.get(normalized)


def default_planning_role_definitions(project_name: str | None = None) -> list[PlanningRoleDefinition]:
    project_label = project_name or "the project"
    return [
        PlanningRoleDefinition(
            key="planner",
            label="Planner",
            goal=f"Turn the constitution for {project_label} into a crisp planning brief.",
            backstory="You ground the team in project intent and define the first durable slice.",
            enabled=True,
            sort_order=1,
        ),
        PlanningRoleDefinition(
            key="architect",
            label="Architect",
            goal=f"Refine the planning brief for {project_label} into concrete structural boundaries.",
            backstory="You identify the shape of the system and the dependencies that matter first.",
            enabled=True,
            sort_order=2,
        ),
        PlanningRoleDefinition(
            key="implementer",
            label="Implementer",
            goal=f"Convert the plan for {project_label} into the smallest shippable implementation slice.",
            backstory="You focus on direct, executable steps that move the project forward.",
            enabled=True,
            sort_order=3,
        ),
        PlanningRoleDefinition(
            key="qa",
            label="QA",
            goal=f"Add verification and acceptance coverage for the first {project_label} slice.",
            backstory="You look for missing checks, edge cases, and review gates.",
            enabled=True,
            sort_order=4,
        ),
        PlanningRoleDefinition(
            key="reviewer",
            label="Reviewer",
            goal=f"Produce an operator-ready planning envelope for {project_label}.",
            backstory="You make sure the final plan is readable, grounded, and ready for handoff.",
            enabled=True,
            sort_order=5,
        ),
        PlanningRoleDefinition(
            key="visual",
            label="Visual",
            goal=f"Surface presentation and visual polish concerns for {project_label}.",
            backstory="You look for user-facing clarity issues and presentation gaps.",
            enabled=False,
            sort_order=6,
        ),
    ]


def normalize_planning_role_definition(value: object, fallback_sort_order: int = 0) -> PlanningRoleDefinition | None:
    if not isinstance(value, dict):
        return None

    raw = value
    key = _normalize_role_key(raw.get("key") or raw.get("roleKey") or raw.get("role_key"))
    label = _clean_text(raw.get("label"))
    goal = _clean_text(raw.get("goal"))
    backstory = _clean_text(raw.get("backstory"))
    if not key or not label or not goal or not backstory:
        return None

    sort_order_value = raw.get("sortOrder") if "sortOrder" in raw else raw.get("sort_order")

    return PlanningRoleDefinition(
        key=key,
        label=label,
        goal=goal,
        backstory=backstory,
        model=_clean_text(raw.get("model")) or None,
        enabled=_coerce_bool(raw.get("enabled"), True),
        sort_order=_coerce_int(sort_order_value, fallback_sort_order),
    )


def normalize_planning_role_definitions(value: object) -> list[PlanningRoleDefinition]:
    if not isinstance(value, list):
        return []

    result: list[PlanningRoleDefinition] = []
    for index, item in enumerate(value):
        definition = normalize_planning_role_definition(item, index)
        if definition is None:
            continue
        result.append(definition)

    return result
