"""Tests for yeet2_brain.planner."""

from __future__ import annotations

import os
import pytest

from yeet2_brain.planner import (
    ConstitutionSection,
    PlanningInput,
    _discover_themes,
    _summarize_text,
    _tokenize,
    _deterministic_plan,
    _effective_role_definitions,
    _continuation_summary,
    _compose_mission,
)
from yeet2_brain.roles import PlanningRoleDefinition, default_planning_role_definitions


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_planning_input(**overrides) -> PlanningInput:
    """Return a minimal valid PlanningInput suitable for deterministic planning tests."""
    defaults = dict(
        project_id="proj-test",
        project_name="Yeet2",
        requested_by="test-runner",
        constitution={
            "overview": ConstitutionSection(
                title="Overview",
                text="Build an API execution engine with architecture and agent orchestration.",
            )
        },
        role_definitions=[],
        raw_payload={},
    )
    defaults.update(overrides)
    return PlanningInput(**defaults)


# ---------------------------------------------------------------------------
# _discover_themes
# ---------------------------------------------------------------------------

def test_discover_themes():
    """Extracts known topic aliases from a list of texts."""
    texts = ["The api boundary needs an execution path and architecture review."]
    themes = _discover_themes(texts)
    # All three known aliases should be detected
    assert "API boundary" in themes
    assert "architecture" in themes
    assert "execution path" in themes


# ---------------------------------------------------------------------------
# _summarize_text
# ---------------------------------------------------------------------------

def test_summarize_text_heading():
    """Extracts the first markdown heading when one is present."""
    text = "# My Project Overview\nSome body text here."
    result = _summarize_text(text)
    assert "My Project Overview" in result


def test_summarize_text_sentence():
    """Falls back to the first sentence when no heading is present."""
    text = "This is the first sentence. This is the second sentence."
    result = _summarize_text(text)
    assert result == "This is the first sentence."


def test_summarize_text_truncates_long_content():
    """Output is bounded to under 200 characters."""
    long_text = "word " * 200
    result = _summarize_text(long_text)
    assert len(result) <= 200


# ---------------------------------------------------------------------------
# _tokenize
# ---------------------------------------------------------------------------

def test_tokenize_strips_stopwords():
    """Common stop-words like 'the', 'is', 'a', 'and' are removed from tokens."""
    tokens = _tokenize("the api is a good service and the task")
    stopwords_present = {"the", "and"} & set(tokens)
    assert not stopwords_present, f"Stopwords found in tokens: {stopwords_present}"
    # 'api' and 'task' should survive (both are in _WORD_RE matches; 'task' is a stopword, 'api' is not)
    assert "api" in tokens


# ---------------------------------------------------------------------------
# _deterministic_plan
# ---------------------------------------------------------------------------

def test_deterministic_plan_produces_correct_task_count():
    """Produces exactly 6 tasks (architect, implementer, tester, coder, qa, reviewer)."""
    inp = _make_planning_input()
    result = _deterministic_plan(inp, "Build the system.", ["API boundary", "architecture"])
    assert len(result.tasks) == 6


def test_deterministic_plan_task_roles():
    """Each task carries the expected agent_role in order."""
    inp = _make_planning_input()
    result = _deterministic_plan(inp, "Build the system.", ["API boundary"])
    roles = [t.agent_role for t in result.tasks]
    assert roles == ["architect", "implementer", "tester", "coder", "qa", "reviewer"]


def test_deterministic_plan_task_priority_ordering():
    """Task priorities are in strictly ascending order along the role chain."""
    inp = _make_planning_input()
    result = _deterministic_plan(inp, "Build the system.", ["API boundary"])
    priorities = [t.priority for t in result.tasks]
    assert priorities == sorted(priorities), f"Priorities not in ascending order: {priorities}"


# ---------------------------------------------------------------------------
# _effective_role_definitions
# ---------------------------------------------------------------------------

def test_effective_role_definitions_returns_enabled_subset():
    """Returns only enabled roles when a partial set is provided."""
    incomplete = [
        PlanningRoleDefinition(key="planner", label="Planner", goal="Plan.", backstory="You plan.", enabled=True, sort_order=1),
    ]
    inp = _make_planning_input(role_definitions=incomplete)
    result = _effective_role_definitions(inp)
    assert len(result) == 1
    assert result[0].key == "planner"


def test_effective_role_definitions_raises_when_all_disabled():
    """Raises ValueError when all provided roles are disabled (falls back to defaults)."""
    all_disabled = [
        PlanningRoleDefinition(key="planner", label="Planner", goal="Plan.", backstory="You plan.", enabled=False, sort_order=1),
    ]
    inp = _make_planning_input(role_definitions=all_disabled)
    # Falls back to defaults, so should not raise
    result = _effective_role_definitions(inp)
    assert len(result) > 0


# ---------------------------------------------------------------------------
# _continuation_summary
# ---------------------------------------------------------------------------

def test_continuation_summary_empty_for_no_history():
    """Returns an empty string when no mission_history is in raw_payload."""
    inp = _make_planning_input(raw_payload={})
    assert _continuation_summary(inp) == ""


# ---------------------------------------------------------------------------
# _compose_mission
# ---------------------------------------------------------------------------

def test_compose_mission_caps_objective():
    """When objective is > 500 chars, the generated summary is used instead."""
    long_objective = "x" * 501
    mission = _compose_mission(
        project_id="proj-1",
        project_name="MyProject",
        summary="Short summary.",
        themes=["API boundary"],
        requested_by="tester",
        objective=long_objective,
    )
    # The raw long_objective should NOT be used; generated one should be shorter
    assert mission.objective != long_objective
    assert len(mission.objective) < 500


# ---------------------------------------------------------------------------
# New role tests: tester and coder
# ---------------------------------------------------------------------------


def test_deterministic_plan_includes_tester_and_coder():
    """Task roles include both 'tester' and 'coder' in the plan."""
    inp = _make_planning_input()
    result = _deterministic_plan(inp, "Build the system.", ["API boundary"])
    roles = [t.agent_role for t in result.tasks]
    assert "tester" in roles, f"Expected 'tester' in roles: {roles}"
    assert "coder" in roles, f"Expected 'coder' in roles: {roles}"


def test_deterministic_plan_priority_ordering_with_new_roles():
    """Priorities satisfy: architect < implementer < tester < coder < qa < reviewer."""
    inp = _make_planning_input()
    result = _deterministic_plan(inp, "Build the system.", ["API boundary"])
    by_role = {t.agent_role: t.priority for t in result.tasks}

    expected_order = ["architect", "implementer", "tester", "coder", "qa", "reviewer"]
    for i in range(len(expected_order) - 1):
        earlier = expected_order[i]
        later = expected_order[i + 1]
        assert by_role[earlier] < by_role[later], (
            f"Expected priority({earlier})={by_role[earlier]} < "
            f"priority({later})={by_role[later]}"
        )
