"""Integration boundary tests for Brain → CrewAI handoff.

These tests verify that _crewai_plan builds the correct payloads and parses
responses correctly, without calling any real CrewAI or LLM services.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, call, patch

import pytest

from yeet2_brain.planner import (
    ConstitutionSection,
    PlanningInput,
    PlanningResult,
    _crewai_plan,
    _crewai_ready,
    plan_project,
)
from yeet2_brain.roles import default_planning_role_definitions


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_planning_input(project_name: str = "TestProject") -> PlanningInput:
    return PlanningInput(
        project_id="proj-001",
        project_name=project_name,
        requested_by="brain",
        constitution={
            "vision": ConstitutionSection(title="Vision", text="Build a great API service for testing."),
            "spec": ConstitutionSection(title="Spec", text="The API must handle agent task execution."),
        },
        role_definitions=default_planning_role_definitions(project_name),
    )


def _make_crew_result(raw: str) -> MagicMock:
    result = MagicMock()
    result.raw = raw
    result.json_dict = None
    result.pydantic = None
    return result


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestCrewaiPlanBuildsCorrectAgentCount:
    """_crewai_plan creates one Agent per enabled role definition."""

    def test_crewai_plan_builds_correct_agent_count(self, monkeypatch: pytest.MonkeyPatch) -> None:
        planning_input = _make_planning_input()
        # 7 enabled roles: planner, architect, implementer, tester, coder, qa, reviewer
        # visual is disabled by default
        expected_count = 7

        mock_crew_instance = MagicMock()
        mock_crew_instance.kickoff.return_value = _make_crew_result(
            json.dumps({
                "summary": "test summary",
                "themes": ["api"],
                "mission_title": "Test Mission",
                "mission_objective": "Test objective.",
                "role_notes": {},
            })
        )

        mock_agent_cls = MagicMock()
        mock_task_cls = MagicMock()
        mock_crew_cls = MagicMock(return_value=mock_crew_instance)
        mock_process = MagicMock()
        mock_process.sequential = "sequential"
        mock_llm_cls = MagicMock(return_value=None)

        monkeypatch.setattr("yeet2_brain.planner.Agent", mock_agent_cls)
        monkeypatch.setattr("yeet2_brain.planner.Task", mock_task_cls)
        monkeypatch.setattr("yeet2_brain.planner.Crew", mock_crew_cls)
        monkeypatch.setattr("yeet2_brain.planner.Process", mock_process)
        monkeypatch.setattr("yeet2_brain.planner.LLM", mock_llm_cls)

        result = _crewai_plan(planning_input, "test summary", ["api"])

        assert mock_agent_cls.call_count == expected_count
        assert isinstance(result, PlanningResult)


class TestCrewaiPlanPassesConstitutionToInputs:
    """crew.kickoff(inputs=…) receives a 'constitution' key with section texts."""

    def test_crewai_plan_passes_constitution_to_inputs(self, monkeypatch: pytest.MonkeyPatch) -> None:
        planning_input = _make_planning_input()

        mock_crew_instance = MagicMock()
        mock_crew_instance.kickoff.return_value = _make_crew_result(
            json.dumps({
                "summary": "s",
                "themes": ["api"],
                "mission_title": "T",
                "mission_objective": "O",
                "role_notes": {},
            })
        )

        mock_crew_cls = MagicMock(return_value=mock_crew_instance)
        mock_process = MagicMock()
        mock_process.sequential = "sequential"

        monkeypatch.setattr("yeet2_brain.planner.Agent", MagicMock())
        monkeypatch.setattr("yeet2_brain.planner.Task", MagicMock())
        monkeypatch.setattr("yeet2_brain.planner.Crew", mock_crew_cls)
        monkeypatch.setattr("yeet2_brain.planner.Process", mock_process)
        monkeypatch.setattr("yeet2_brain.planner.LLM", MagicMock(return_value=None))

        _crewai_plan(planning_input, "test summary", ["api"])

        assert mock_crew_instance.kickoff.called
        _, kwargs = mock_crew_instance.kickoff.call_args
        inputs = kwargs.get("inputs") or mock_crew_instance.kickoff.call_args[0][0]
        assert "constitution" in inputs
        constitution = inputs["constitution"]
        # Only sections with non-empty text appear
        assert "vision" in constitution
        assert "Build a great API service for testing." in constitution["vision"]
        assert "spec" in constitution
        assert "The API must handle agent task execution." in constitution["spec"]


class TestCrewaiPlanParsesValidJsonResult:
    """A valid JSON response from crew.kickoff is parsed into a PlanningResult."""

    def test_crewai_plan_parses_valid_json_result(self, monkeypatch: pytest.MonkeyPatch) -> None:
        planning_input = _make_planning_input()
        raw_json = json.dumps({
            "summary": "test summary from crew",
            "themes": ["api", "testing"],
            "mission_title": "Test Mission Title",
            "mission_objective": "Test mission objective text.",
            "role_notes": {},
        })

        mock_crew_instance = MagicMock()
        mock_crew_instance.kickoff.return_value = _make_crew_result(raw_json)

        mock_process = MagicMock()
        mock_process.sequential = "sequential"

        monkeypatch.setattr("yeet2_brain.planner.Agent", MagicMock())
        monkeypatch.setattr("yeet2_brain.planner.Task", MagicMock())
        monkeypatch.setattr("yeet2_brain.planner.Crew", MagicMock(return_value=mock_crew_instance))
        monkeypatch.setattr("yeet2_brain.planner.Process", mock_process)
        monkeypatch.setattr("yeet2_brain.planner.LLM", MagicMock(return_value=None))

        result = _crewai_plan(planning_input, "fallback summary", ["api"])

        assert isinstance(result, PlanningResult)
        assert result.mission.title == "Test Mission Title"
        assert result.mission.objective == "Test mission objective text."
        assert result.source == "crewai"


class TestCrewaiPlanCapsLongObjective:
    """When mission_objective > 500 chars, _compose_mission falls back to the generated summary."""

    def test_crewai_plan_caps_long_objective(self, monkeypatch: pytest.MonkeyPatch) -> None:
        planning_input = _make_planning_input()
        long_objective = "x" * 501
        raw_json = json.dumps({
            "summary": "concise summary for fallback",
            "themes": ["api"],
            "mission_title": "Long Title",
            "mission_objective": long_objective,
            "role_notes": {},
        })

        mock_crew_instance = MagicMock()
        mock_crew_instance.kickoff.return_value = _make_crew_result(raw_json)

        mock_process = MagicMock()
        mock_process.sequential = "sequential"

        monkeypatch.setattr("yeet2_brain.planner.Agent", MagicMock())
        monkeypatch.setattr("yeet2_brain.planner.Task", MagicMock())
        monkeypatch.setattr("yeet2_brain.planner.Crew", MagicMock(return_value=mock_crew_instance))
        monkeypatch.setattr("yeet2_brain.planner.Process", mock_process)
        monkeypatch.setattr("yeet2_brain.planner.LLM", MagicMock(return_value=None))

        result = _crewai_plan(planning_input, "concise summary for fallback", ["api"])

        # The 500+ char objective must NOT be used — the generated objective is used instead
        assert result.mission.objective != long_objective
        # The generated objective incorporates the summary text
        assert "concise summary for fallback" in result.mission.objective


class TestCrewaiPlanFallsBackOnException:
    """When crewai is not requested, plan_project uses _deterministic_plan."""

    def test_crewai_plan_falls_back_on_exception(self, monkeypatch: pytest.MonkeyPatch) -> None:
        planning_input = _make_planning_input()

        # Force backend to deterministic so _crewai_requested() returns False
        monkeypatch.setenv("YEET2_BRAIN_PLANNER_BACKEND", "deterministic")

        deterministic_called = []

        from yeet2_brain import planner as planner_mod
        original_deterministic = planner_mod._deterministic_plan

        def fake_deterministic(pi, summary, themes):
            deterministic_called.append(True)
            return original_deterministic(pi, summary, themes)

        monkeypatch.setattr("yeet2_brain.planner._deterministic_plan", fake_deterministic)

        result = plan_project(planning_input)

        assert deterministic_called, "Expected _deterministic_plan to be called when crewai is not requested"
        assert result.source == "brain"

    def test_crewai_plan_raises_when_not_ready(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """_crewai_plan raises RuntimeError when crewai libs are not importable."""
        planning_input = _make_planning_input()

        # Simulate crewai not installed
        monkeypatch.setattr("yeet2_brain.planner.Agent", None)
        monkeypatch.setattr("yeet2_brain.planner.Crew", None)
        monkeypatch.setattr("yeet2_brain.planner.Process", None)
        monkeypatch.setattr("yeet2_brain.planner.Task", None)

        with pytest.raises(RuntimeError, match="CrewAI is not installed"):
            _crewai_plan(planning_input, "summary", ["api"])


class TestCrewaiPlanTaskDescriptionsRequestConciseOutput:
    """Each Task description must contain the concise-output instructions."""

    def test_crewai_plan_task_descriptions_request_concise_output(self, monkeypatch: pytest.MonkeyPatch) -> None:
        planning_input = _make_planning_input()

        mock_crew_instance = MagicMock()
        mock_crew_instance.kickoff.return_value = _make_crew_result(
            json.dumps({
                "summary": "s",
                "themes": ["api"],
                "mission_title": "T",
                "mission_objective": "O",
                "role_notes": {},
            })
        )

        created_tasks: list[MagicMock] = []

        def capture_task(**kwargs: object) -> MagicMock:
            t = MagicMock()
            t.description = kwargs.get("description", "")
            t.expected_output = kwargs.get("expected_output", "")
            created_tasks.append(t)
            return t

        mock_process = MagicMock()
        mock_process.sequential = "sequential"

        monkeypatch.setattr("yeet2_brain.planner.Agent", MagicMock())
        monkeypatch.setattr("yeet2_brain.planner.Task", capture_task)
        monkeypatch.setattr("yeet2_brain.planner.Crew", MagicMock(return_value=mock_crew_instance))
        monkeypatch.setattr("yeet2_brain.planner.Process", mock_process)
        monkeypatch.setattr("yeet2_brain.planner.LLM", MagicMock(return_value=None))

        _crewai_plan(planning_input, "test summary", ["api"])

        assert created_tasks, "Expected at least one Task to be created"
        for task in created_tasks:
            assert "2-3 sentences max" in task.description, (
                f"Task description missing '2-3 sentences max': {task.description!r}"
            )
            assert "NOT the raw constitution text" in task.description, (
                f"Task description missing 'NOT the raw constitution text': {task.description!r}"
            )
