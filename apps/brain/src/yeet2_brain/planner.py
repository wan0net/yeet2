"""Planning helpers for the Brain service."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
import json
import os
import re
from enum import StrEnum
from typing import Any, Mapping
from uuid import uuid4

from .roles import (
    PlanningRoleDefinition,
    Role,
    default_planning_role_definitions,
)

try:
    from crewai import Agent, Crew, LLM, Process, Task
except Exception:  # pragma: no cover - optional dependency
    Agent = None
    Crew = None
    LLM = None
    Process = None
    Task = None

_WORD_RE = re.compile(r"[a-z0-9][a-z0-9_-]+", re.IGNORECASE)
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")
_STOPWORDS = {
    "about",
    "after",
    "again",
    "all",
    "also",
    "and",
    "any",
    "are",
    "back",
    "build",
    "can",
    "core",
    "create",
    "current",
    "day",
    "for",
    "from",
    "have",
    "into",
    "keep",
    "later",
    "make",
    "must",
    "next",
    "not",
    "note",
    "only",
    "plan",
    "project",
    "repo",
    "roadmap",
    "service",
    "spec",
    "start",
    "task",
    "this",
    "that",
    "the",
    "their",
    "them",
    "there",
    "these",
    "they",
    "through",
    "with",
    "work",
}


@dataclass(slots=True)
class ConstitutionSection:
    title: str
    text: str = ""


@dataclass(slots=True)
class PlanningInput:
    project_id: str
    project_name: str
    requested_by: str
    constitution: dict[str, ConstitutionSection]
    role_definitions: list[PlanningRoleDefinition] = field(default_factory=list)
    raw_payload: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class PlannedTask:
    id: str
    title: str
    description: str
    agent_role: str
    status: str
    priority: int
    acceptance_criteria: list[str]
    attempts: int = 0
    blocker_reason: str | None = None


@dataclass(slots=True)
class PlannedMission:
    id: str
    project_id: str
    title: str
    objective: str
    status: str
    created_by: str
    started_at: str | None = None
    completed_at: str | None = None


@dataclass(slots=True)
class PlanningResult:
    mission: PlannedMission
    tasks: list[PlannedTask]
    themes: list[str]
    summary: str
    source: str


class PlannerBackend(StrEnum):
    AUTO = "auto"
    CREWAI = "crewai"
    DETERMINISTIC = "deterministic"


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


def _env_text(name: str) -> str:
    return os.getenv(name, "").strip()


def _env_flag(name: str) -> bool:
    value = _env_text(name).lower()
    return value in {"1", "true", "yes", "on"}


def _planner_backend() -> PlannerBackend:
    raw = _env_text("YEET2_BRAIN_PLANNER_BACKEND").lower()
    try:
        return PlannerBackend(raw or PlannerBackend.AUTO.value)
    except ValueError:
        return PlannerBackend.AUTO


def _crewai_model_name() -> str:
    return (
        _env_text("YEET2_BRAIN_CREWAI_MODEL")
        or _env_text("OPENAI_MODEL_NAME")
        or _env_text("MODEL")
    )


def _crewai_requested() -> bool:
    backend = _planner_backend()
    if backend == PlannerBackend.DETERMINISTIC:
        return False
    if backend == PlannerBackend.CREWAI:
        return True
    return bool(_crewai_model_name() or _env_flag("YEET2_BRAIN_CREWAI_ENABLED"))


def _crewai_ready() -> bool:
    return all((Agent, Crew, Process, Task))


def _crewai_llm_for_model(model_name: str | None) -> object | None:
    if not model_name or LLM is None:
        return None
    return LLM(model=model_name, temperature=0.2)


def _crewai_llm() -> object | None:
    return _crewai_llm_for_model(_crewai_model_name())


def _normalize_role_key(value: object) -> str | None:
    if not isinstance(value, str):
        return None

    normalized = value.strip().lower()
    return normalized or None


def _sort_role_definitions(role_definitions: list[PlanningRoleDefinition]) -> list[PlanningRoleDefinition]:
    return sorted(role_definitions, key=lambda definition: (definition.sort_order, definition.label.lower(), definition.key))


def _effective_role_definitions(planning_input: PlanningInput) -> list[PlanningRoleDefinition]:
    role_definitions = planning_input.role_definitions or default_planning_role_definitions(planning_input.project_name)
    enabled = [definition for definition in _sort_role_definitions(role_definitions) if definition.enabled]
    if not enabled:
        raise ValueError("No enabled planning role definitions were provided")
    return enabled


def _to_text_list(value: object) -> list[str]:
    if isinstance(value, str):
        parts = [part.strip() for part in re.split(r"[,\n;]+", value) if part.strip()]
        return parts or ([value.strip()] if value.strip() else [])
    if isinstance(value, list):
        result: list[str] = []
        for item in value:
            text = _clean_text(item)
            if text:
                result.append(text)
        return result
    return []


def _json_fragment(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        fence = stripped.find("\n")
        if fence != -1:
            stripped = stripped[fence + 1 :]
        if stripped.endswith("```"):
            stripped = stripped[:-3].strip()

    start = stripped.find("{")
    if start == -1:
        raise ValueError("No JSON object found")

    depth = 0
    in_string = False
    escape = False
    for index in range(start, len(stripped)):
        char = stripped[index]
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return stripped[start : index + 1]

    raise ValueError("Unterminated JSON object")


def _mapping_from_result(result: object) -> dict[str, Any]:
    if isinstance(result, Mapping):
        return dict(result)

    for attr in ("json_dict", "pydantic"):
        candidate = getattr(result, attr, None)
        if candidate is None:
            continue
        if isinstance(candidate, Mapping):
            return dict(candidate)
        if hasattr(candidate, "model_dump"):
            return dict(candidate.model_dump())
        if hasattr(candidate, "dict"):
            return dict(candidate.dict())

    if hasattr(result, "to_dict"):
        candidate = result.to_dict()
        if isinstance(candidate, Mapping):
            return dict(candidate)

    raw = getattr(result, "raw", result)
    if not isinstance(raw, str):
        raw = str(raw)
    return json.loads(_json_fragment(raw))


def _note_for(notes: Mapping[str, str], role: Role) -> str:
    for key in (role.value, role.value.lower(), role.name, role.name.lower()):
        note = notes.get(key)
        if note:
            return note
    return ""


def _note_for_role_key(notes: Mapping[str, str], role_key: str) -> str:
    normalized = role_key.strip().lower()
    return notes.get(normalized, "")


def _mission_history(planning_input: PlanningInput) -> list[dict[str, Any]]:
    raw_history = planning_input.raw_payload.get("mission_history")
    if not isinstance(raw_history, list):
        return []

    history: list[dict[str, Any]] = []
    for item in raw_history:
        if isinstance(item, Mapping):
            history.append(dict(item))
    return history


def _latest_mission_history(planning_input: PlanningInput) -> dict[str, Any] | None:
    history = _mission_history(planning_input)
    return history[0] if history else None


def _continuation_summary(planning_input: PlanningInput) -> str:
    latest = _latest_mission_history(planning_input)
    if not latest:
        return ""

    title = _clean_text(latest.get("title")) or "the previous mission"
    objective = _clean_text(latest.get("objective"))
    status = _clean_text(latest.get("status"))
    parts = [f"Continue from the previous mission \"{title}\""]
    if status:
        parts.append(f"(status: {status})")
    if objective:
        parts.append(f"Objective: {objective}.")
    parts.append("Avoid repeating completed work and build on the established roadmap.")
    return " ".join(parts)


def _summarize_text(text: str) -> str:
    text = " ".join(text.split())
    if not text:
        return ""

    paragraphs = [part.strip() for part in text.splitlines() if part.strip()]
    for paragraph in paragraphs:
        if paragraph.startswith("#"):
            candidate = paragraph.lstrip("#").strip()
            if candidate:
                return candidate

    sentences = [part.strip() for part in _SENTENCE_RE.split(text) if part.strip()]
    if sentences:
        return sentences[0]
    return text[:180].strip()


def _tokenize(text: str) -> list[str]:
    return [
        token.lower()
        for token in _WORD_RE.findall(text)
        if token.lower() not in _STOPWORDS
    ]


def _topic_map() -> dict[str, str]:
    return {
        "api": "API boundary",
        "architecture": "architecture",
        "agent": "agent orchestration",
        "agents": "agent orchestration",
        "brain": "brain orchestration",
        "blocker": "blocker handling",
        "control": "control surface",
        "constitution": "constitution flow",
        "database": "database persistence",
        "docs": "documentation",
        "execution": "execution path",
        "github": "GitHub integration",
        "job": "job tracking",
        "mission": "mission planning",
        "nomad": "distributed execution",
        "planner": "planning loop",
        "qa": "quality assurance",
        "review": "review workflow",
        "task": "task planning",
        "testing": "verification",
        "ui": "operator UI",
        "visual": "visual review",
        "worker": "worker routing",
    }


def _discover_themes(texts: list[str]) -> list[str]:
    counts: dict[str, int] = {}
    aliases = _topic_map()

    for text in texts:
        for token in _tokenize(text):
            topic = aliases.get(token)
            if topic:
                counts[topic] = counts.get(topic, 0) + 1

    return [topic for topic, _ in sorted(counts.items(), key=lambda item: (-item[1], item[0]))]


def _compose_mission(
    project_id: str,
    project_name: str,
    summary: str,
    themes: list[str],
    requested_by: str,
    *,
    title: str | None = None,
    objective: str | None = None,
    continuation_summary: str = "",
) -> PlannedMission:
    mission_title = title or (
        f"Continue {project_name} from the previous mission" if continuation_summary else f"Advance {project_name} from the constitution"
    )
    objective_bits = [summary] if summary else []
    if themes:
        objective_bits.append(f"Focus areas: {', '.join(themes[:3])}.")
    if continuation_summary:
        objective_bits.append(continuation_summary)
    mission_objective = objective or " ".join(bit for bit in objective_bits if bit).strip() or (
        f"Establish the first durable planning loop for {project_name}."
    )

    return PlannedMission(
        id=f"mission-{uuid4().hex}",
        project_id=project_id,
        title=mission_title,
        objective=mission_objective,
        status="active",
        created_by=requested_by,
    )


def _task_acceptance(label: str, detail: str) -> list[str]:
    return [
        f"{label} is represented in the project plan.",
        detail,
        "Work is visible in the control UI and can be reviewed by a human operator.",
    ]


def _primary_task(project_name: str, theme: str | None, note: str = "") -> PlannedTask:
    topic = theme or "the first roadmap slice"
    title = f"Shape the first {topic} milestone"
    description = (
        f"Turn the constitution for {project_name} into a concrete implementation slice centered on {topic}."
    )
    if note:
        description = f"{description} {note}"
    return PlannedTask(
        id=f"task-{uuid4().hex}",
        title=title,
        description=description,
        agent_role=Role.PLANNER.value,
        status="queued",
        priority=1,
        acceptance_criteria=_task_acceptance(
            "Planning output",
            f"The plan names the immediate {topic} work and the main implementation path.",
        ),
    )


def _implementation_task(project_name: str, theme: str | None, note: str = "") -> PlannedTask:
    topic = theme or "project state"
    title = f"Implement the {topic} path"
    description = (
        f"Use the project constitution to define the first shippable change for {project_name}, centered on {topic}."
    )
    if note:
        description = f"{description} {note}"
    return PlannedTask(
        id=f"task-{uuid4().hex}",
        title=title,
        description=description,
        agent_role=Role.IMPLEMENTER.value,
        status="queued",
        priority=2,
        acceptance_criteria=_task_acceptance(
            "Implementation slice",
            f"The work produces a visible change for the {topic} area and is ready for review.",
        ),
    )


def _verification_task(project_name: str, theme: str | None, note: str = "") -> PlannedTask:
    topic = theme or "the project plan"
    title = f"Verify the {topic} deliverable"
    description = f"Add the checks and review steps needed to trust the first {topic} deliverable for {project_name}."
    if note:
        description = f"{description} {note}"
    return PlannedTask(
        id=f"task-{uuid4().hex}",
        title=title,
        description=description,
        agent_role=Role.QA.value,
        status="queued",
        priority=3,
        acceptance_criteria=_task_acceptance(
            "Verification coverage",
            f"At least one focused check or review path exists for the {topic} slice.",
        ),
    )


def _fallback_task(project_name: str, note: str = "") -> PlannedTask:
    title = f"Stabilize the operator path for {project_name}"
    description = (
        f"Make sure the first plan for {project_name} can be understood, reviewed, and handed back to the operator."
    )
    if note:
        description = f"{description} {note}"
    return PlannedTask(
        id=f"task-{uuid4().hex}",
        title=title,
        description=description,
        agent_role=Role.REVIEWER.value,
        status="queued",
        priority=4,
        acceptance_criteria=_task_acceptance(
            "Operator handoff",
            "The plan is readable enough for an operator to approve the next step.",
        ),
    )


def _deterministic_plan(planning_input: PlanningInput, summary: str, themes: list[str]) -> PlanningResult:
    continuation_summary = _continuation_summary(planning_input)
    mission = _compose_mission(
        planning_input.project_id,
        planning_input.project_name,
        summary,
        themes,
        planning_input.requested_by,
        continuation_summary=continuation_summary,
    )

    primary_theme = themes[0] if themes else None
    secondary_theme = themes[1] if len(themes) > 1 else None

    tasks = [
        _primary_task(planning_input.project_name, primary_theme),
        _implementation_task(planning_input.project_name, secondary_theme or primary_theme),
        _verification_task(planning_input.project_name, primary_theme),
        _fallback_task(planning_input.project_name),
    ]

    return PlanningResult(
        mission=mission,
        tasks=tasks,
        themes=themes,
        summary=summary
        or (
            f"Continue the next durable slice for {planning_input.project_name}."
            if continuation_summary
            else f"Plan the first durable slice for {planning_input.project_name}."
        ),
        source="brain",
    )


def _crewai_plan(planning_input: PlanningInput, summary: str, themes: list[str]) -> PlanningResult:
    if not _crewai_ready():
        raise RuntimeError("CrewAI is not installed")

    project_name = planning_input.project_name
    constitution_summary = summary or f"Plan the first durable slice for {project_name}."
    constitution_themes = themes or [project_name]
    role_definitions = _effective_role_definitions(planning_input)
    continuation_summary = _continuation_summary(planning_input)
    mission_history = _mission_history(planning_input)

    def allow_delegation_for(role_key: str) -> bool:
        return role_key in {"planner", "architect"}

    agents = [
        Agent(
            role=definition.label,
            goal=definition.goal,
            backstory=definition.backstory,
            allow_delegation=allow_delegation_for(definition.key),
            **(
                {"llm": _crewai_llm_for_model(definition.model or _crewai_model_name())}
                if (definition.model or _crewai_model_name())
                else {}
            ),
        )
        for definition in role_definitions
    ]

    input_payload = {
        "project_name": project_name,
        "project_id": planning_input.project_id,
        "requested_by": planning_input.requested_by,
        "summary": constitution_summary,
        "themes": constitution_themes,
        "continuation_summary": continuation_summary,
        "mission_history": mission_history,
        "role_definitions": [asdict(definition) for definition in role_definitions],
        "constitution": {
            key: section.text
            for key, section in planning_input.constitution.items()
            if section.text.strip()
        },
    }

    tasks = [
        Task(
            description=(
                f"Read the constitution for {project_name}. As the {definition.label} role, "
                f"focus on {definition.goal}. Return only valid JSON with summary, themes, "
                "mission_title, mission_objective, and role_notes."
            ),
            expected_output="Valid JSON with summary, themes, mission_title, mission_objective, and role_notes.",
            agent=agent,
        )
        for definition, agent in zip(role_definitions, agents)
    ]

    crew = Crew(
        agents=agents,
        tasks=tasks,
        process=Process.sequential,
        memory=False,
        verbose=False,
    )

    result = crew.kickoff(inputs=input_payload)
    payload = _mapping_from_result(result)

    summary_text = _clean_text(payload.get("summary")) or constitution_summary
    themes_text = _to_text_list(payload.get("themes")) or constitution_themes
    title_text = _clean_text(payload.get("mission_title"))
    objective_text = _clean_text(payload.get("mission_objective"))

    notes_payload = payload.get("role_notes")
    notes: dict[str, str] = {}
    if isinstance(notes_payload, Mapping):
        for key, value in notes_payload.items():
            text = _clean_text(value)
            if text:
                normalized_key = _normalize_role_key(str(key))
                if normalized_key:
                    notes[normalized_key] = text

    mission = _compose_mission(
        planning_input.project_id,
        planning_input.project_name,
        summary_text,
        themes_text,
        planning_input.requested_by,
        title=title_text or None,
        objective=objective_text or None,
        continuation_summary=continuation_summary,
    )

    primary_theme = themes_text[0] if themes_text else None
    secondary_theme = themes_text[1] if len(themes_text) > 1 else None

    tasks_result = [
        _primary_task(planning_input.project_name, primary_theme, _note_for_role_key(notes, "planner") or _note_for(notes, Role.PLANNER)),
        _implementation_task(
            planning_input.project_name,
            secondary_theme or primary_theme,
            _note_for_role_key(notes, "implementer") or _note_for(notes, Role.IMPLEMENTER),
        ),
        _verification_task(planning_input.project_name, primary_theme, _note_for_role_key(notes, "qa") or _note_for(notes, Role.QA)),
        _fallback_task(planning_input.project_name, _note_for_role_key(notes, "reviewer") or _note_for(notes, Role.REVIEWER)),
    ]

    if note := _note_for_role_key(notes, "architect") or _note_for(notes, Role.ARCHITECT):
        tasks_result[0].description = f"{tasks_result[0].description} {note}"

    return PlanningResult(
        mission=mission,
        tasks=tasks_result,
        themes=themes_text,
        summary=summary_text
        or (
            f"Continue the next durable slice for {planning_input.project_name}."
            if continuation_summary
            else f"Plan the first durable slice for {planning_input.project_name}."
        ),
        source="crewai",
    )


def plan_project(planning_input: PlanningInput) -> PlanningResult:
    texts = [section.text for section in planning_input.constitution.values() if section.text.strip()]
    summary_source = " ".join(texts)
    summary = _summarize_text(summary_source)
    themes = _discover_themes(texts or [planning_input.project_name])

    if _crewai_requested():
        return _crewai_plan(planning_input, summary, themes)

    return _deterministic_plan(planning_input, summary, themes)
