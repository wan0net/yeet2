"""Workflow decision helpers for the Brain service."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class WorkflowDecisionInput:
    project_id: str
    project_name: str
    autonomy_mode: str
    has_in_flight_jobs: bool
    needs_initial_planning: bool
    needs_backlog_planning: bool
    next_dispatchable_task_id: str | None
    next_dispatchable_task_role: str | None
    pull_request_mode: str
    pull_request_draft_mode: str
    merge_approval_mode: str
    latest_completed_job_id: str | None
    latest_completed_task_id: str | None
    latest_completed_task_title: str | None
    latest_completed_job_has_pull_request: bool
    latest_completed_reviewer_complete: bool
    latest_completed_dispatchable_tasks_complete: bool


@dataclass(slots=True)
class WorkflowDecision:
    action: str
    reason: str
    source: str = "brain"
    target_task_id: str | None = None
    target_task_role: str | None = None
    target_job_id: str | None = None


@dataclass(slots=True)
class WorkflowStageBriefInput:
    project_id: str
    project_name: str
    mission_id: str | None
    mission_title: str | None
    mission_objective: str | None
    task_id: str
    task_title: str
    task_description: str
    task_agent_role: str
    task_priority: int
    task_attempts: int
    acceptance_criteria: list[str]
    assigned_role_label: str | None
    assigned_role_goal: str | None
    assigned_role_backstory: str | None
    operator_guidance: list[dict[str, Any]]


@dataclass(slots=True)
class WorkflowStageBrief:
    instructions: str
    working_summary: str
    handoff_target_role: str | None
    success_signals: list[str]
    source: str = "brain"


def _clean_text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _clean_flag(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return False


def _clean_int(value: object, default: int = 0) -> int:
    if isinstance(value, bool):
        return default
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        try:
            return int(value.strip())
        except ValueError:
            return default
    return default


def _clean_text_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def workflow_decision_input_from_payload(payload: dict[str, Any]) -> WorkflowDecisionInput:
    return WorkflowDecisionInput(
        project_id=_clean_text(payload.get("project_id")),
        project_name=_clean_text(payload.get("project_name")),
        autonomy_mode=_clean_text(payload.get("autonomy_mode")) or "manual",
        has_in_flight_jobs=_clean_flag(payload.get("has_in_flight_jobs")),
        needs_initial_planning=_clean_flag(payload.get("needs_initial_planning")),
        needs_backlog_planning=_clean_flag(payload.get("needs_backlog_planning")),
        next_dispatchable_task_id=_clean_text(payload.get("next_dispatchable_task_id")) or None,
        next_dispatchable_task_role=_clean_text(payload.get("next_dispatchable_task_role")) or None,
        pull_request_mode=_clean_text(payload.get("pull_request_mode")) or "manual",
        pull_request_draft_mode=_clean_text(payload.get("pull_request_draft_mode")) or "draft",
        merge_approval_mode=_clean_text(payload.get("merge_approval_mode")) or "human_approval",
        latest_completed_job_id=_clean_text(payload.get("latest_completed_job_id")) or None,
        latest_completed_task_id=_clean_text(payload.get("latest_completed_task_id")) or None,
        latest_completed_task_title=_clean_text(payload.get("latest_completed_task_title")) or None,
        latest_completed_job_has_pull_request=_clean_flag(payload.get("latest_completed_job_has_pull_request")),
        latest_completed_reviewer_complete=_clean_flag(payload.get("latest_completed_reviewer_complete")),
        latest_completed_dispatchable_tasks_complete=_clean_flag(payload.get("latest_completed_dispatchable_tasks_complete")),
    )


def workflow_stage_brief_input_from_payload(payload: dict[str, Any]) -> WorkflowStageBriefInput:
    operator_guidance = payload.get("operator_guidance")
    guidance_items = operator_guidance if isinstance(operator_guidance, list) else []
    normalized_guidance = [item for item in guidance_items if isinstance(item, dict)]
    return WorkflowStageBriefInput(
        project_id=_clean_text(payload.get("project_id")),
        project_name=_clean_text(payload.get("project_name")),
        mission_id=_clean_text(payload.get("mission_id")) or None,
        mission_title=_clean_text(payload.get("mission_title")) or None,
        mission_objective=_clean_text(payload.get("mission_objective")) or None,
        task_id=_clean_text(payload.get("task_id")),
        task_title=_clean_text(payload.get("task_title")),
        task_description=_clean_text(payload.get("task_description")),
        task_agent_role=_clean_text(payload.get("task_agent_role")) or "implementer",
        task_priority=_clean_int(payload.get("task_priority"), 0),
        task_attempts=_clean_int(payload.get("task_attempts"), 0),
        acceptance_criteria=_clean_text_list(payload.get("acceptance_criteria")),
        assigned_role_label=_clean_text(payload.get("assigned_role_label")) or None,
        assigned_role_goal=_clean_text(payload.get("assigned_role_goal")) or None,
        assigned_role_backstory=_clean_text(payload.get("assigned_role_backstory")) or None,
        operator_guidance=normalized_guidance,
    )


def _latest_guidance_text(input: WorkflowStageBriefInput) -> str:
    if not input.operator_guidance:
        return ""
    latest = input.operator_guidance[0]
    actor = _clean_text(latest.get("actor")) or "the team"
    content = _clean_text(latest.get("content"))
    if not content:
        return ""
    return f"Latest guidance from {actor}: {content}"


def _next_role_for(role_key: str) -> str | None:
    normalized = role_key.strip().lower()
    if normalized == "planner":
        return "architect"
    if normalized == "architect":
        return "implementer"
    if normalized == "implementer":
        return "qa"
    if normalized == "qa":
        return "reviewer"
    if normalized == "reviewer":
        return "planner"
    return None


def build_stage_brief(input: WorkflowStageBriefInput) -> WorkflowStageBrief:
    role_key = input.task_agent_role.strip().lower() or "implementer"
    role_label = input.assigned_role_label or role_key
    success_signals = input.acceptance_criteria or ["Task acceptance criteria are satisfied and the outcome is ready for handoff."]
    guidance = _latest_guidance_text(input)
    mission_context = input.mission_objective or input.mission_title or f"Advance {input.project_name} safely."
    priority_context = f"Priority {input.task_priority}" if input.task_priority > 0 else "Standard priority"
    attempts_context = (
        f"This is attempt {input.task_attempts + 1}; be explicit about any blockers."
        if input.task_attempts > 0
        else "Treat this as the first pass and keep the output easy to review."
    )

    role_focus = {
        "architect": "Validate scope, constraints, and technical direction before code changes begin.",
        "implementer": "Execute the concrete change in the repo while staying within the approved boundary.",
        "qa": "Verify the result against the acceptance criteria and surface regressions or missing checks.",
        "reviewer": "Review the completed work for correctness, maintainability, and spec alignment.",
        "planner": "Reconcile the mission against the constitution and decide the next clean step.",
        "visual": "Review the UX and visual outcome against the intended product experience.",
    }.get(role_key, "Advance the assigned task and keep the mission aligned to the spec.")

    parts = [
        f"You are acting as {role_label} for project {input.project_name}.",
        mission_context,
        f"Current task: {input.task_title}.",
        input.task_description,
        role_focus,
        priority_context + ".",
        attempts_context,
        "Acceptance criteria:",
        *[f"- {item}" for item in success_signals],
    ]
    if input.assigned_role_goal:
        parts.append(f"Role goal: {input.assigned_role_goal}")
    if guidance:
        parts.append(guidance)

    working_summary = {
        "architect": f"Reviewing the implementation boundary for \"{input.task_title}\" and checking it against the constitution.",
        "implementer": f"Implementing \"{input.task_title}\" while staying inside the approved architecture and acceptance criteria.",
        "qa": f"Verifying \"{input.task_title}\" against the expected checks and regressions.",
        "reviewer": f"Reviewing \"{input.task_title}\" for correctness, maintainability, and spec alignment.",
        "planner": f"Planning the next step around \"{input.task_title}\" and keeping the mission aligned.",
        "visual": f"Reviewing the visual quality of \"{input.task_title}\" against product intent.",
    }.get(role_key, f"Working on \"{input.task_title}\".")

    return WorkflowStageBrief(
        instructions="\n".join(part for part in parts if part),
        working_summary=working_summary,
        handoff_target_role=_next_role_for(role_key),
        success_signals=success_signals,
    )


def decide_next_action(input: WorkflowDecisionInput) -> WorkflowDecision:
    if input.autonomy_mode == "manual":
        return WorkflowDecision(action="idle", reason="Project is in manual mode.")

    if input.has_in_flight_jobs:
        return WorkflowDecision(action="idle", reason="A job is already in flight, so the team should wait for results.")

    if input.needs_initial_planning:
        return WorkflowDecision(action="plan", reason="The project has not been planned yet.")

    if input.needs_backlog_planning:
        return WorkflowDecision(action="plan", reason="The active backlog is running low and needs another mission planned.")

    if input.autonomy_mode == "supervised":
        return WorkflowDecision(action="idle", reason="Supervised mode allows planning, but waits for operator approval before dispatch.")

    if input.next_dispatchable_task_id:
        return WorkflowDecision(
            action="advance",
            reason=f"Task {input.next_dispatchable_task_id} is ready for {input.next_dispatchable_task_role or 'the next specialist'}.",
            target_task_id=input.next_dispatchable_task_id,
            target_task_role=input.next_dispatchable_task_role,
        )

    if not input.latest_completed_job_id:
        return WorkflowDecision(action="idle", reason="No completed implementer job is available for pull request or merge automation.")

    if not input.latest_completed_job_has_pull_request:
        if input.pull_request_mode == "manual":
            return WorkflowDecision(action="idle", reason="Pull request automation is disabled by policy.")
        if input.pull_request_mode == "after_reviewer" and not input.latest_completed_reviewer_complete:
            return WorkflowDecision(action="idle", reason="Reviewer sign-off is still required before opening the pull request.")
        return WorkflowDecision(
            action="pull_request",
            reason=f"Open a pull request for {input.latest_completed_task_title or 'the latest completed implementation task'}.",
            target_job_id=input.latest_completed_job_id,
            target_task_id=input.latest_completed_task_id,
        )

    if input.pull_request_draft_mode != "ready":
        return WorkflowDecision(action="idle", reason="The pull request is still a draft, so merge automation should wait.")

    if input.merge_approval_mode == "human_approval":
        return WorkflowDecision(action="idle", reason="Human approval is required before merging the pull request.")

    if input.merge_approval_mode == "agent_signoff" and not input.latest_completed_reviewer_complete:
        return WorkflowDecision(action="idle", reason="Reviewer sign-off is still required before merging the pull request.")

    if input.merge_approval_mode == "no_approval" and not input.latest_completed_dispatchable_tasks_complete:
        return WorkflowDecision(action="idle", reason="All dispatchable tasks must complete before auto-merge is allowed.")

    return WorkflowDecision(
        action="merge",
        reason=f"Merge the pull request for {input.latest_completed_task_title or 'the latest completed implementation task'}.",
        target_job_id=input.latest_completed_job_id,
        target_task_id=input.latest_completed_task_id,
    )
