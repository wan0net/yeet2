"""Tests for yeet2_brain.interview."""

from __future__ import annotations

import sys
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from yeet2_brain.interview import (
    INTERVIEW_QUESTIONS,
    InterviewResult,
    _count_answered,
    _get_active_questions,
    _is_system_message,
    _make_openai_client,
    _message_content,
    _suggest_template,
    _template_synthesis,
    interview_step,
    serialize_interview_result,
)


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------


def _system_msg(step: int, text: str = "question") -> dict[str, Any]:
    """Simulate a planner system message with an interviewStep detail."""
    return {
        "actor": "planner",
        "summary": text,
        "detail": {"source": "system", "interviewStep": step},
    }


def _operator_msg(text: str) -> dict[str, Any]:
    """Simulate an operator reply."""
    return {
        "actor": "operator",
        "summary": text,
        "detail": {"source": "operator"},
    }


def _build_full_history() -> list[dict[str, Any]]:
    """Return a chat history with all 5 Q&A pairs answered."""
    history: list[dict[str, Any]] = []
    for q in INTERVIEW_QUESTIONS:
        history.append(_system_msg(q["step"], q["question"]))
        history.append(_operator_msg(f"Answer for step {q['step']}"))
    return history


# ---------------------------------------------------------------------------
# interview_step — basic stepping
# ---------------------------------------------------------------------------


def test_interview_step_first_question():
    """Empty chat history returns step 0 question."""
    result = interview_step({"project_name": "TestProject", "chat_history": []})
    assert result.action == "ask"
    assert result.interview_step == 0
    assert result.question == INTERVIEW_QUESTIONS[0]["question"]


def test_interview_step_after_one_answer():
    """Chat with one Q&A pair returns step 1 question."""
    history = [
        _system_msg(0, INTERVIEW_QUESTIONS[0]["question"]),
        _operator_msg("We are building a task runner."),
    ]
    result = interview_step({"project_name": "TestProject", "chat_history": history})
    assert result.action == "ask"
    assert result.interview_step == 1
    assert result.question == INTERVIEW_QUESTIONS[1]["question"]


def test_interview_step_after_all_answers():
    """Five Q&A pairs returns action='synthesize' with files."""
    history = _build_full_history()
    result = interview_step({"project_name": "TestProject", "chat_history": history})
    assert result.action == "synthesize"
    assert result.files is not None
    assert "vision" in result.files
    assert "spec" in result.files
    assert "roadmap" in result.files


def test_interview_step_total_steps_is_always_set():
    """total_steps is always the number of questions, regardless of step."""
    result = interview_step({"project_name": "X", "chat_history": []})
    assert result.total_steps == len(INTERVIEW_QUESTIONS)


# ---------------------------------------------------------------------------
# _count_answered
# ---------------------------------------------------------------------------


def test_count_answered_empty():
    """Empty history returns 0."""
    assert _count_answered([]) == 0


def test_count_answered_question_no_answer():
    """System question with no operator answer returns 0."""
    history = [_system_msg(0, "What is this project?")]
    assert _count_answered(history) == 0


def test_count_answered_one_pair():
    """One question + one answer returns 1."""
    history = [
        _system_msg(0, "What is this project?"),
        _operator_msg("It is a CLI tool."),
    ]
    assert _count_answered(history) == 1


def test_count_answered_multiple_pairs():
    """Three Q&A pairs returns 3."""
    history = []
    for i in range(3):
        history.append(_system_msg(i, f"Question {i}"))
        history.append(_operator_msg(f"Answer {i}"))
    assert _count_answered(history) == 3


def test_count_answered_trailing_unanswered_question():
    """Two answered + one trailing unanswered returns 2."""
    history = [
        _system_msg(0, "Q0"),
        _operator_msg("A0"),
        _system_msg(1, "Q1"),
        _operator_msg("A1"),
        _system_msg(2, "Q2"),  # unanswered
    ]
    assert _count_answered(history) == 2


# ---------------------------------------------------------------------------
# _is_system_message
# ---------------------------------------------------------------------------


def test_is_system_message_planner_with_interview_step():
    """actor='planner' with interviewStep in detail is a system message."""
    msg = _system_msg(0, "What is this project?")
    assert _is_system_message(msg) is True


def test_is_system_message_operator():
    """actor='operator' is NOT a system message."""
    msg = _operator_msg("I am the operator.")
    assert _is_system_message(msg) is False


def test_is_system_message_planner_without_step():
    """actor='planner' with source='system' but no interviewStep is still system."""
    msg = {"actor": "planner", "summary": "thinking", "detail": {"source": "system"}}
    assert _is_system_message(msg) is True


def test_is_system_message_non_operator_no_source():
    """actor='assistant' with empty detail (no source, no interviewStep) is NOT a system message."""
    msg = {"actor": "assistant", "summary": "I will help.", "detail": {}}
    assert _is_system_message(msg) is False


def test_is_system_message_non_operator_with_system_source():
    """actor='assistant' with source='system' in detail IS a system message."""
    msg = {"actor": "assistant", "summary": "I will help.", "detail": {"source": "system"}}
    assert _is_system_message(msg) is True


# ---------------------------------------------------------------------------
# _template_synthesis
# ---------------------------------------------------------------------------


def test_template_synthesis_produces_three_files():
    """Template fallback produces exactly vision, spec, and roadmap keys."""
    qa_pairs = [
        ("Q0", "Answer zero"),
        ("Q1", "Answer one"),
        ("Q2", "Answer two"),
        ("Q3", "Answer three"),
        ("Q4", "Answer four"),
    ]
    result = _template_synthesis("MyProject", qa_pairs)
    assert set(result.keys()) == {"vision", "spec", "roadmap"}


def test_template_synthesis_content_includes_answers():
    """Each answer appears in at least one of the generated documents."""
    qa_pairs = [
        ("Q0", "UniqueVisionContent"),
        ("Q1", "UniqueFeatureContent"),
        ("Q2", "UniqueConstraintContent"),
        ("Q3", "UniqueMilestoneContent"),
        ("Q4", "UniqueSuccessContent"),
    ]
    result = _template_synthesis("MyProject", qa_pairs)
    all_content = result["vision"] + result["spec"] + result["roadmap"]
    for _, answer in qa_pairs:
        assert answer in all_content, f"Expected '{answer}' to appear in synthesized docs"


def test_template_synthesis_includes_project_name():
    """Project name appears as a heading in each generated document."""
    result = _template_synthesis("SpecialProject", [("Q", "A")] * 5)
    assert "SpecialProject" in result["vision"]
    assert "SpecialProject" in result["spec"]
    assert "SpecialProject" in result["roadmap"]


def test_template_synthesis_empty_pairs_uses_fallback():
    """Empty qa_pairs produces documents with 'Not specified.' placeholders."""
    result = _template_synthesis("EmptyProject", [])
    assert "Not specified." in result["vision"]
    assert "Not specified." in result["spec"]
    assert "Not specified." in result["roadmap"]


# ---------------------------------------------------------------------------
# _message_content
# ---------------------------------------------------------------------------


def test_message_content_reads_summary_field():
    """Helper reads the 'summary' field (API format)."""
    msg = {"actor": "planner", "summary": "This is a summary.", "detail": {}}
    assert _message_content(msg) == "This is a summary."


def test_message_content_reads_content_field():
    """Helper reads the 'content' field (Brain format), preferring it over summary."""
    msg = {"actor": "operator", "content": "This is content.", "summary": "ignored"}
    assert _message_content(msg) == "This is content."


def test_message_content_strips_whitespace():
    """Content is stripped of leading/trailing whitespace."""
    msg = {"actor": "operator", "summary": "  padded  "}
    assert _message_content(msg) == "padded"


def test_message_content_returns_empty_string_for_missing():
    """Returns empty string when neither content nor summary is present."""
    msg = {"actor": "operator"}
    assert _message_content(msg) == ""


# ---------------------------------------------------------------------------
# serialize_interview_result
# ---------------------------------------------------------------------------


def test_serialize_interview_result_ask():
    """Ask result serializes with question and step."""
    result = InterviewResult(
        action="ask",
        question="What is this project?",
        interview_step=0,
        total_steps=5,
    )
    serialized = serialize_interview_result(result)
    assert serialized["action"] == "ask"
    assert serialized["question"] == "What is this project?"
    assert serialized["interviewStep"] == 0
    assert serialized["totalSteps"] == 5
    assert "files" not in serialized


def test_serialize_interview_result_synthesize():
    """Synthesize result serializes with files, not question."""
    files = {"vision": "# Vision\n...", "spec": "# Spec\n...", "roadmap": "# Roadmap\n..."}
    result = InterviewResult(action="synthesize", total_steps=5, files=files)
    serialized = serialize_interview_result(result)
    assert serialized["action"] == "synthesize"
    assert serialized["files"] == files
    assert serialized["totalSteps"] == 5
    assert "question" not in serialized
    assert "interviewStep" not in serialized


def test_serialize_interview_result_ask_has_no_files():
    """Ask result does not include a 'files' key."""
    result = InterviewResult(action="ask", question="Q?", interview_step=2, total_steps=5)
    serialized = serialize_interview_result(result)
    assert "files" not in serialized


def test_serialize_interview_result_synthesize_has_no_question():
    """Synthesize result does not include 'question' or 'interviewStep' keys."""
    result = InterviewResult(action="synthesize", total_steps=5, files={"vision": "", "spec": "", "roadmap": ""})
    serialized = serialize_interview_result(result)
    assert "question" not in serialized
    assert "interviewStep" not in serialized


def test_serialize_interview_result_suggested_template_included():
    """Synthesize result includes suggestedTemplate when set."""
    result = InterviewResult(
        action="synthesize",
        total_steps=6,
        files={"vision": "v", "spec": "s", "roadmap": "r"},
        suggested_template="software",
    )
    serialized = serialize_interview_result(result)
    assert serialized.get("suggestedTemplate") == "software"


def test_serialize_interview_result_no_suggested_template_when_absent():
    """Synthesize result omits suggestedTemplate when not set."""
    result = InterviewResult(
        action="synthesize",
        total_steps=5,
        files={"vision": "", "spec": "", "roadmap": ""},
    )
    serialized = serialize_interview_result(result)
    assert "suggestedTemplate" not in serialized


# ---------------------------------------------------------------------------
# _make_openai_client
# ---------------------------------------------------------------------------


def test_make_openai_client_uses_langfuse_when_keys_present(monkeypatch):
    """When LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are set and langfuse
    is importable, the returned client comes from langfuse.openai."""
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "pk-test")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "sk-test")

    fake_client = MagicMock(name="LangfuseOpenAI-instance")
    fake_langfuse_openai = MagicMock()
    fake_langfuse_openai.OpenAI.return_value = fake_client

    with patch.dict(sys.modules, {"langfuse": MagicMock(), "langfuse.openai": fake_langfuse_openai}):
        client = _make_openai_client("key", "https://openrouter.ai/api/v1")

    assert client is fake_client
    fake_langfuse_openai.OpenAI.assert_called_once_with(
        api_key="key", base_url="https://openrouter.ai/api/v1"
    )


def test_make_openai_client_uses_plain_openai_when_no_langfuse_keys(monkeypatch):
    """When LANGFUSE keys are absent, openai.OpenAI is used directly."""
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)

    fake_client = MagicMock(name="openai-plain")
    fake_openai = MagicMock()
    fake_openai.OpenAI.return_value = fake_client

    with patch.dict(sys.modules, {"openai": fake_openai}):
        client = _make_openai_client("mykey", "https://example.com")

    assert client is fake_client
    fake_openai.OpenAI.assert_called_once_with(api_key="mykey", base_url="https://example.com")


# ---------------------------------------------------------------------------
# _get_active_questions
# ---------------------------------------------------------------------------


def test_get_active_questions_no_rerun_returns_all():
    """Without rerun flag, all questions are returned regardless of existing_files."""
    result = _get_active_questions(["vision", "spec", "roadmap"], rerun=False)
    assert result == INTERVIEW_QUESTIONS


def test_get_active_questions_rerun_skips_completed_targets():
    """With rerun=True, questions whose targets all exist are skipped.
    The template question is never skipped."""
    # vision, spec, and roadmap all exist
    existing = ["vision", "spec", "roadmap", "architecture"]
    result = _get_active_questions(existing, rerun=True)
    # template question (step 0) must always be present
    steps = [q["step"] for q in result]
    assert 0 in steps
    # steps 1 (vision only) and 3 (spec only) should be skipped
    assert 1 not in steps
    assert 3 not in steps


def test_get_active_questions_rerun_keeps_partial_targets():
    """With rerun=True, a question whose target is multi-file is kept
    if at least one target is missing."""
    # "vision+spec" question (step 2) — only vision exists, spec missing
    existing = ["vision"]
    result = _get_active_questions(existing, rerun=True)
    steps = [q["step"] for q in result]
    assert 2 in steps


def test_get_active_questions_rerun_empty_existing_returns_all():
    """With rerun=True but no existing files, all questions are returned."""
    result = _get_active_questions([], rerun=True)
    assert len(result) == len(INTERVIEW_QUESTIONS)


# ---------------------------------------------------------------------------
# _suggest_template
# ---------------------------------------------------------------------------


def test_suggest_template_none_input_returns_software():
    """None input defaults to 'software'."""
    assert _suggest_template(None) == "software"


def test_suggest_template_keyword_match_content():
    """A writing/content answer returns 'content'."""
    with patch("yeet2_brain.interview._llm_suggest_template", return_value=None):
        result = _suggest_template("We are writing blog articles and editorial copy")
    assert result == "content"


def test_suggest_template_keyword_match_research():
    """A research-oriented answer returns 'research'."""
    with patch("yeet2_brain.interview._llm_suggest_template", return_value=None):
        result = _suggest_template("An academic investigation and study of survey data")
    assert result == "research"


def test_suggest_template_unknown_answer_returns_custom():
    """An answer with no matching keywords returns 'custom'."""
    with patch("yeet2_brain.interview._llm_suggest_template", return_value=None):
        # No substring of any keyword list appears here
        result = _suggest_template("frobnicator blorptastic zzmrph 99999")
    assert result == "custom"


def test_suggest_template_llm_result_takes_precedence():
    """When the LLM returns a valid template key it overrides keyword matching."""
    with patch("yeet2_brain.interview._llm_suggest_template", return_value="legal"):
        result = _suggest_template("marketing campaign social media")
    assert result == "legal"
