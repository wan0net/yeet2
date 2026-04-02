"""Deterministic planning helpers for the Brain service."""

from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Any
from uuid import uuid4

from .roles import Role

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
) -> PlannedMission:
    mission_title = f"Advance {project_name} from the constitution"
    objective_bits = [summary] if summary else []
    if themes:
        objective_bits.append(f"Focus areas: {', '.join(themes[:3])}.")
    objective = " ".join(bit for bit in objective_bits if bit).strip() or (
        f"Establish the first durable planning loop for {project_name}."
    )

    return PlannedMission(
        id=f"mission-{uuid4().hex}",
        project_id=project_id,
        title=mission_title,
        objective=objective,
        status="active",
        created_by=requested_by,
    )


def _task_acceptance(label: str, detail: str) -> list[str]:
    return [
        f"{label} is represented in the project plan.",
        detail,
        "Work is visible in the control UI and can be reviewed by a human operator.",
    ]


def _primary_task(project_name: str, theme: str | None) -> PlannedTask:
    topic = theme or "the first roadmap slice"
    title = f"Shape the first {topic} milestone"
    description = (
        f"Turn the constitution for {project_name} into a concrete implementation slice centered on {topic}."
    )
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


def _implementation_task(project_name: str, theme: str | None) -> PlannedTask:
    topic = theme or "project state"
    title = f"Implement the {topic} path"
    description = (
        f"Use the project constitution to define the first shippable change for {project_name}, centered on {topic}."
    )
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


def _verification_task(project_name: str, theme: str | None) -> PlannedTask:
    topic = theme or "the project plan"
    title = f"Verify the {topic} deliverable"
    description = f"Add the checks and review steps needed to trust the first {topic} deliverable for {project_name}."
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


def _fallback_task(project_name: str) -> PlannedTask:
    title = f"Stabilize the operator path for {project_name}"
    description = (
        f"Make sure the first plan for {project_name} can be understood, reviewed, and handed back to the operator."
    )
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


def plan_project(planning_input: PlanningInput) -> PlanningResult:
    texts = [section.text for section in planning_input.constitution.values() if section.text.strip()]
    summary_source = " ".join(texts)
    summary = _summarize_text(summary_source)
    themes = _discover_themes(texts or [planning_input.project_name])

    mission = _compose_mission(
        planning_input.project_id,
        planning_input.project_name,
        summary,
        themes,
        planning_input.requested_by,
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
        summary=summary or f"Plan the first durable slice for {planning_input.project_name}.",
    )
