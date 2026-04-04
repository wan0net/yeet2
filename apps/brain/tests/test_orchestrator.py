"""Tests for yeet2_brain.orchestrator workflow decision engine."""

from __future__ import annotations

import pytest

from yeet2_brain.orchestrator import (
    WorkflowDecisionInput,
    WorkflowStageBriefInput,
    _dispatch_role_rank,
    _next_role_for,
    _choose_dispatchable_task,
    build_stage_brief,
    decide_next_action,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_decision_input(**overrides) -> WorkflowDecisionInput:
    """Return a WorkflowDecisionInput with safe defaults for testing.

    Every field that drives a decision is off / False by default so tests only
    need to supply the fields they care about.
    """
    defaults = dict(
        project_id="proj-1",
        project_name="TestProject",
        autonomy_mode="autonomous",
        has_in_flight_jobs=False,
        needs_initial_planning=False,
        needs_backlog_planning=False,
        dispatchable_tasks=[],
        next_dispatchable_task_id=None,
        next_dispatchable_task_role=None,
        pull_request_mode="auto",
        pull_request_draft_mode="ready",
        merge_approval_mode="no_approval",
        latest_completed_job_id=None,
        latest_completed_task_id=None,
        latest_completed_task_title=None,
        latest_completed_job_has_pull_request=False,
        latest_completed_reviewer_complete=False,
        latest_completed_dispatchable_tasks_complete=True,
    )
    defaults.update(overrides)
    return WorkflowDecisionInput(**defaults)


def _make_stage_brief_input(**overrides) -> WorkflowStageBriefInput:
    """Return a WorkflowStageBriefInput with safe defaults for testing."""
    defaults = dict(
        project_id="proj-1",
        project_name="TestProject",
        mission_id="mission-abc",
        mission_title="Test Mission",
        mission_objective="Build something great.",
        task_id="task-1",
        task_title="Sample Task",
        task_description="Do the thing.",
        task_agent_role="implementer",
        task_priority=0,
        task_attempts=0,
        acceptance_criteria=["Criterion one."],
        assigned_role_label=None,
        assigned_role_goal=None,
        assigned_role_backstory=None,
        operator_guidance=[],
    )
    defaults.update(overrides)
    return WorkflowStageBriefInput(**defaults)


# ---------------------------------------------------------------------------
# decide_next_action tests
# ---------------------------------------------------------------------------

def test_idle_for_manual_mode():
    inp = _make_decision_input(autonomy_mode="manual")
    result = decide_next_action(inp)
    assert result.action == "idle"
    assert "manual" in result.reason.lower()


def test_idle_when_in_flight_jobs():
    inp = _make_decision_input(has_in_flight_jobs=True)
    result = decide_next_action(inp)
    assert result.action == "idle"
    assert "in flight" in result.reason.lower() or "already" in result.reason.lower()


def test_plan_for_initial_planning():
    inp = _make_decision_input(needs_initial_planning=True)
    result = decide_next_action(inp)
    assert result.action == "plan"


def test_plan_for_backlog_planning():
    inp = _make_decision_input(needs_backlog_planning=True)
    result = decide_next_action(inp)
    assert result.action == "plan"


def test_idle_for_supervised_after_planning():
    """Supervised mode should idle after planning-related decisions are checked."""
    inp = _make_decision_input(
        autonomy_mode="supervised",
        needs_initial_planning=False,
        needs_backlog_planning=False,
    )
    result = decide_next_action(inp)
    assert result.action == "idle"
    assert "supervised" in result.reason.lower()


def test_advance_with_target_task():
    """Returns advance action carrying the correct task_id and role."""
    inp = _make_decision_input(
        dispatchable_tasks=[
            {"id": "task-42", "agent_role": "coder", "priority": 1, "title": "Do it"}
        ]
    )
    result = decide_next_action(inp)
    assert result.action == "advance"
    assert result.target_task_id == "task-42"
    assert result.target_task_role == "coder"


# ---------------------------------------------------------------------------
# _dispatch_role_rank tests
# ---------------------------------------------------------------------------

def test_dispatch_role_rank_ordering():
    """Architect < implementer < tester < coder < qa < reviewer < planner < visual."""
    roles_in_order = ["architect", "implementer", "tester", "coder", "qa", "reviewer", "planner", "visual"]
    ranks = [_dispatch_role_rank(r) for r in roles_in_order]
    assert ranks == sorted(ranks), f"Ranks not in ascending order: {list(zip(roles_in_order, ranks))}"


# ---------------------------------------------------------------------------
# _choose_dispatchable_task tests
# ---------------------------------------------------------------------------

def test_choose_dispatchable_task_by_role_rank():
    """Picks the task with the lower role rank (architect over implementer)."""
    inp = _make_decision_input(
        dispatchable_tasks=[
            {"id": "task-impl", "agent_role": "implementer", "priority": 1, "title": "Impl"},
            {"id": "task-arch", "agent_role": "architect", "priority": 1, "title": "Arch"},
        ]
    )
    chosen = _choose_dispatchable_task(inp)
    assert chosen is not None
    assert chosen["id"] == "task-arch"


def test_choose_dispatchable_task_by_priority():
    """Picks lower priority number when role ranks are equal."""
    inp = _make_decision_input(
        dispatchable_tasks=[
            {"id": "task-high", "agent_role": "coder", "priority": 10, "title": "High"},
            {"id": "task-low", "agent_role": "coder", "priority": 2, "title": "Low"},
        ]
    )
    chosen = _choose_dispatchable_task(inp)
    assert chosen is not None
    assert chosen["id"] == "task-low"


# ---------------------------------------------------------------------------
# PR and merge decision tests
# ---------------------------------------------------------------------------

def test_pr_decision_when_complete_no_pr():
    """Returns pull_request when job is complete, no PR exists yet, and policy allows."""
    inp = _make_decision_input(
        pull_request_mode="auto",
        latest_completed_job_id="job-99",
        latest_completed_task_id="task-99",
        latest_completed_task_title="Implement feature X",
        latest_completed_job_has_pull_request=False,
        latest_completed_reviewer_complete=True,
    )
    result = decide_next_action(inp)
    assert result.action == "pull_request"
    assert result.target_job_id == "job-99"


def test_pr_idle_for_manual_mode():
    """Returns idle when pull_request_mode is 'manual'."""
    inp = _make_decision_input(
        pull_request_mode="manual",
        latest_completed_job_id="job-99",
        latest_completed_job_has_pull_request=False,
    )
    result = decide_next_action(inp)
    assert result.action == "idle"
    assert "pull request" in result.reason.lower() or "pr" in result.reason.lower() or "policy" in result.reason.lower()


def test_pr_idle_after_reviewer_not_complete():
    """Returns idle for after_reviewer mode when reviewer has not signed off."""
    inp = _make_decision_input(
        pull_request_mode="after_reviewer",
        latest_completed_job_id="job-99",
        latest_completed_job_has_pull_request=False,
        latest_completed_reviewer_complete=False,
    )
    result = decide_next_action(inp)
    assert result.action == "idle"
    assert "reviewer" in result.reason.lower()


def test_merge_when_all_conditions_met():
    """Returns merge when PR exists, draft_mode is ready, no_approval, all tasks complete."""
    inp = _make_decision_input(
        merge_approval_mode="no_approval",
        pull_request_draft_mode="ready",
        latest_completed_job_id="job-99",
        latest_completed_task_id="task-99",
        latest_completed_task_title="Implement Y",
        latest_completed_job_has_pull_request=True,
        latest_completed_dispatchable_tasks_complete=True,
    )
    result = decide_next_action(inp)
    assert result.action == "merge"
    assert result.target_job_id == "job-99"


def test_merge_idle_for_human_approval():
    """Returns idle when merge_approval_mode is human_approval."""
    inp = _make_decision_input(
        merge_approval_mode="human_approval",
        pull_request_draft_mode="ready",
        latest_completed_job_id="job-99",
        latest_completed_job_has_pull_request=True,
        latest_completed_dispatchable_tasks_complete=True,
    )
    result = decide_next_action(inp)
    assert result.action == "idle"
    assert "human" in result.reason.lower() or "approval" in result.reason.lower()


def test_merge_idle_for_agent_signoff_no_reviewer():
    """Returns idle for agent_signoff when reviewer has not completed."""
    inp = _make_decision_input(
        merge_approval_mode="agent_signoff",
        pull_request_draft_mode="ready",
        latest_completed_job_id="job-99",
        latest_completed_job_has_pull_request=True,
        latest_completed_reviewer_complete=False,
        latest_completed_dispatchable_tasks_complete=True,
    )
    result = decide_next_action(inp)
    assert result.action == "idle"
    assert "reviewer" in result.reason.lower()


# ---------------------------------------------------------------------------
# _next_role_for chain tests
# ---------------------------------------------------------------------------

def test_next_role_chain():
    """Verify the full handoff chain: planner → architect → implementer → tester → coder → qa → reviewer → planner."""
    chain = ["planner", "architect", "implementer", "tester", "coder", "qa", "reviewer"]
    for i, role in enumerate(chain):
        expected_next = chain[(i + 1) % len(chain)]
        assert _next_role_for(role) == expected_next, (
            f"Expected _next_role_for({role!r}) == {expected_next!r}"
        )


# ---------------------------------------------------------------------------
# build_stage_brief tests
# ---------------------------------------------------------------------------

_ALL_ROLES = ["architect", "implementer", "tester", "coder", "qa", "reviewer"]


def test_stage_brief_for_each_role():
    """build_stage_brief returns non-empty instructions and working_summary for every workflow role."""
    for role in _ALL_ROLES:
        inp = _make_stage_brief_input(task_agent_role=role)
        brief = build_stage_brief(inp)
        assert brief.instructions, f"Empty instructions for role={role}"
        assert brief.working_summary, f"Empty working_summary for role={role}"


def test_stage_brief_handoff_target():
    """handoff_target_role follows the _next_role_for chain for each workflow role."""
    for role in _ALL_ROLES:
        inp = _make_stage_brief_input(task_agent_role=role)
        brief = build_stage_brief(inp)
        expected = _next_role_for(role)
        assert brief.handoff_target_role == expected, (
            f"For role={role}: expected handoff={expected!r}, got {brief.handoff_target_role!r}"
        )
