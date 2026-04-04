"""Tests for yeet2_brain.roles."""

from __future__ import annotations

import pytest

from yeet2_brain.roles import (
    Role,
    PlanningRoleDefinition,
    default_planning_role_definitions,
    normalize_planning_role_definition,
    recommended_model_for_role_key,
)


# ---------------------------------------------------------------------------
# Role enum
# ---------------------------------------------------------------------------

def test_role_enum_members():
    """Role enum must have exactly the 8 expected members."""
    expected = {"planner", "architect", "implementer", "tester", "coder", "qa", "reviewer", "visual"}
    actual = {member.value for member in Role}
    assert actual == expected


# ---------------------------------------------------------------------------
# recommended_model_for_role_key
# ---------------------------------------------------------------------------

def test_recommended_model_for_known_roles():
    """Returns a non-empty model string for every known role key."""
    known_roles = ["planner", "architect", "implementer", "tester", "coder", "qa", "reviewer", "visual"]
    for role in known_roles:
        model = recommended_model_for_role_key(role)
        assert model, f"No model returned for role={role!r}"
        assert isinstance(model, str)


def test_recommended_model_for_unknown_role():
    """Returns None for an unrecognised role key."""
    assert recommended_model_for_role_key("fake_role") is None


# ---------------------------------------------------------------------------
# default_planning_role_definitions
# ---------------------------------------------------------------------------

def test_default_planning_role_definitions_count():
    """Returns exactly 8 role definitions."""
    definitions = default_planning_role_definitions()
    assert len(definitions) == 8


def test_default_planning_role_definitions_visual_disabled():
    """The visual role definition is disabled by default."""
    definitions = default_planning_role_definitions()
    visual_defs = [d for d in definitions if d.key == "visual"]
    assert len(visual_defs) == 1, "Expected exactly one visual role definition"
    assert not visual_defs[0].enabled


def test_default_planning_role_definitions_required_enabled():
    """planner, architect, implementer, tester, coder, qa, and reviewer are all enabled."""
    required = {"planner", "architect", "implementer", "tester", "coder", "qa", "reviewer"}
    definitions = default_planning_role_definitions()
    enabled_keys = {d.key for d in definitions if d.enabled}
    missing = required - enabled_keys
    assert not missing, f"Required roles not enabled: {missing}"


# ---------------------------------------------------------------------------
# normalize_planning_role_definition
# ---------------------------------------------------------------------------

def _valid_role_dict(**overrides) -> dict:
    base = {
        "key": "tester",
        "label": "Tester",
        "goal": "Write tests.",
        "backstory": "You ensure quality.",
    }
    base.update(overrides)
    return base


def test_normalize_planning_role_definition_from_dict():
    """Accepts 'roleKey', 'role_key', and 'key' aliases for the role key field."""
    # key alias
    result_key = normalize_planning_role_definition({"key": "tester", "label": "Tester", "goal": "Write tests.", "backstory": "Quality guard."})
    assert result_key is not None
    assert result_key.key == "tester"

    # roleKey alias
    result_role_key = normalize_planning_role_definition({"roleKey": "qa", "label": "QA", "goal": "Verify.", "backstory": "Edge cases."})
    assert result_role_key is not None
    assert result_role_key.key == "qa"

    # role_key alias
    result_snake = normalize_planning_role_definition({"role_key": "reviewer", "label": "Reviewer", "goal": "Review.", "backstory": "Final check."})
    assert result_snake is not None
    assert result_snake.key == "reviewer"


def test_normalize_planning_role_definition_returns_none_for_invalid():
    """Returns None when value is not a dict."""
    assert normalize_planning_role_definition(None) is None
    assert normalize_planning_role_definition("planner") is None
    assert normalize_planning_role_definition(42) is None
    assert normalize_planning_role_definition([]) is None
