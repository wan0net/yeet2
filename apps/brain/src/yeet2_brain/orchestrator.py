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


def _clean_text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _clean_flag(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return False


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
