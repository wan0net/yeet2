"""Tests for yeet2_brain.interview."""

from __future__ import annotations

import sys
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from yeet2_brain.interview import (
    InterviewConfigError,
    InterviewResult,
    VALID_TEMPLATES,
    _history_to_llm_messages,
    _is_system_message,
    _make_openai_client,
    _message_content,
    interview_step,
    serialize_interview_result,
)


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------


def _system_msg(step: int, text: str = "question") -> dict[str, Any]:
    return {
        "actor": "planner",
        "summary": text,
        "detail": {"source": "system", "interviewStep": step},
    }


def _operator_msg(text: str) -> dict[str, Any]:
    return {
        "actor": "operator",
        "summary": text,
        "detail": {"source": "operator"},
    }


def _make_llm_response(content: str) -> MagicMock:
    """Build a fake openai-style response object."""
    choice = MagicMock()
    choice.message.content = content
    response = MagicMock()
    response.choices = [choice]
    return response


# ---------------------------------------------------------------------------
# _is_system_message
# ---------------------------------------------------------------------------


def test_is_system_message_planner_with_interview_step():
    assert _is_system_message(_system_msg(0)) is True


def test_is_system_message_operator():
    assert _is_system_message(_operator_msg("answer")) is False


def test_is_system_message_planner_with_system_source_no_step():
    msg = {"actor": "planner", "summary": "thinking", "detail": {"source": "system"}}
    assert _is_system_message(msg) is True


def test_is_system_message_non_operator_no_source():
    msg = {"actor": "assistant", "summary": "hi", "detail": {}}
    assert _is_system_message(msg) is False


def test_is_system_message_non_operator_with_system_source():
    msg = {"actor": "assistant", "summary": "hi", "detail": {"source": "system"}}
    assert _is_system_message(msg) is True


# ---------------------------------------------------------------------------
# _message_content
# ---------------------------------------------------------------------------


def test_message_content_reads_summary_field():
    msg = {"actor": "planner", "summary": "This is a summary.", "detail": {}}
    assert _message_content(msg) == "This is a summary."


def test_message_content_reads_content_field():
    msg = {"actor": "operator", "content": "content value", "summary": "ignored"}
    assert _message_content(msg) == "content value"


def test_message_content_strips_whitespace():
    msg = {"actor": "operator", "summary": "  padded  "}
    assert _message_content(msg) == "padded"


def test_message_content_returns_empty_for_missing():
    msg = {"actor": "operator"}
    assert _message_content(msg) == ""


# ---------------------------------------------------------------------------
# _history_to_llm_messages
# ---------------------------------------------------------------------------


def test_history_to_llm_messages_system_becomes_assistant():
    history = [_system_msg(0, "What is this project?")]
    messages = _history_to_llm_messages(history)
    assert messages == [{"role": "assistant", "content": "What is this project?"}]


def test_history_to_llm_messages_operator_becomes_user():
    history = [_operator_msg("It is a CLI tool.")]
    messages = _history_to_llm_messages(history)
    assert messages == [{"role": "user", "content": "It is a CLI tool."}]


def test_history_to_llm_messages_mixed_order():
    history = [
        _system_msg(0, "Q0"),
        _operator_msg("A0"),
        _system_msg(1, "Q1"),
    ]
    messages = _history_to_llm_messages(history)
    assert [m["role"] for m in messages] == ["assistant", "user", "assistant"]


def test_history_to_llm_messages_skips_empty_content():
    history = [
        {"actor": "planner", "summary": "", "detail": {"source": "system"}},
        _operator_msg("real answer"),
    ]
    messages = _history_to_llm_messages(history)
    assert len(messages) == 1
    assert messages[0]["content"] == "real answer"


# ---------------------------------------------------------------------------
# interview_step — config error
# ---------------------------------------------------------------------------


def test_interview_step_raises_when_no_llm_configured(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("LLM_MODEL", raising=False)
    monkeypatch.delenv("YEET2_BRAIN_CREWAI_MODEL", raising=False)

    with pytest.raises(InterviewConfigError):
        interview_step({"project_name": "TestProject", "chat_history": []})


def test_interview_step_raises_when_api_key_missing(monkeypatch):
    monkeypatch.setenv("LLM_MODEL", "gpt-4o")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    with pytest.raises(InterviewConfigError, match="OPENROUTER_API_KEY"):
        interview_step({"project_name": "P", "chat_history": []})


def test_interview_step_raises_when_model_missing(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    monkeypatch.delenv("LLM_MODEL", raising=False)
    monkeypatch.delenv("YEET2_BRAIN_CREWAI_MODEL", raising=False)

    with pytest.raises(InterviewConfigError, match="LLM_MODEL"):
        interview_step({"project_name": "P", "chat_history": []})


# ---------------------------------------------------------------------------
# interview_step — LLM-driven happy paths
# ---------------------------------------------------------------------------


def _mock_llm_env(monkeypatch):
    monkeypatch.setenv("LLM_MODEL", "gpt-4o-mini")
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test-key")
    monkeypatch.setenv("LLM_BASE_URL", "https://openrouter.ai/api/v1")


def test_interview_step_returns_ask_from_llm(monkeypatch):
    _mock_llm_env(monkeypatch)

    llm_json = '{"action": "ask", "question": "What does this project do?", "interview_step": 0, "total_steps": 5}'
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = _make_llm_response(llm_json)

    with patch("yeet2_brain.interview._make_openai_client", return_value=fake_client):
        result = interview_step({"project_name": "TestProject", "chat_history": []})

    assert result.action == "ask"
    assert result.question == "What does this project do?"
    assert result.interview_step == 0
    assert result.total_steps == 5


def test_interview_step_returns_synthesize_from_llm(monkeypatch):
    _mock_llm_env(monkeypatch)

    llm_json = """{
        "action": "synthesize",
        "suggested_template": "software",
        "files": {
            "vision": "# Vision\\nPurpose.",
            "spec": "# Spec\\nFeatures.",
            "roadmap": "# Roadmap\\nMilestone."
        }
    }"""
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = _make_llm_response(llm_json)

    history = [_system_msg(0, "Q"), _operator_msg("A")] * 3
    with patch("yeet2_brain.interview._make_openai_client", return_value=fake_client):
        result = interview_step({"project_name": "TestProject", "chat_history": history})

    assert result.action == "synthesize"
    assert result.suggested_template == "software"
    assert result.files is not None
    assert "vision" in result.files
    assert "spec" in result.files
    assert "roadmap" in result.files


def test_interview_step_llm_json_wrapped_in_fences(monkeypatch):
    """LLM response wrapped in markdown fences is parsed correctly."""
    _mock_llm_env(monkeypatch)

    llm_json = '```json\n{"action": "ask", "question": "Tell me more.", "interview_step": 1, "total_steps": 5}\n```'
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = _make_llm_response(llm_json)

    with patch("yeet2_brain.interview._make_openai_client", return_value=fake_client):
        result = interview_step({"project_name": "P", "chat_history": []})

    assert result.action == "ask"
    assert result.question == "Tell me more."


def test_interview_step_project_name_injected_into_first_message(monkeypatch):
    """Project name is prepended to the first user message sent to the LLM."""
    _mock_llm_env(monkeypatch)

    captured_messages: list[Any] = []

    def fake_create(**kwargs):
        captured_messages.extend(kwargs.get("messages", []))
        return _make_llm_response('{"action": "ask", "question": "Q?", "interview_step": 0, "total_steps": 5}')

    fake_client = MagicMock()
    fake_client.chat.completions.create.side_effect = fake_create

    with patch("yeet2_brain.interview._make_openai_client", return_value=fake_client):
        interview_step({"project_name": "MyApp", "chat_history": []})

    user_msgs = [m for m in captured_messages if m.get("role") == "user"]
    assert any("MyApp" in m["content"] for m in user_msgs)


def test_interview_step_raises_on_bad_json(monkeypatch):
    _mock_llm_env(monkeypatch)

    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = _make_llm_response("not json at all")

    with patch("yeet2_brain.interview._make_openai_client", return_value=fake_client):
        with pytest.raises(RuntimeError, match="non-JSON"):
            interview_step({"project_name": "P", "chat_history": []})


def test_interview_step_raises_on_empty_question(monkeypatch):
    _mock_llm_env(monkeypatch)

    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = _make_llm_response(
        '{"action": "ask", "question": "", "interview_step": 0, "total_steps": 5}'
    )

    with patch("yeet2_brain.interview._make_openai_client", return_value=fake_client):
        with pytest.raises(RuntimeError, match="no question"):
            interview_step({"project_name": "P", "chat_history": []})


def test_interview_step_raises_on_incomplete_synthesis(monkeypatch):
    _mock_llm_env(monkeypatch)

    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = _make_llm_response(
        '{"action": "synthesize", "files": {"vision": "v", "spec": "s"}}'  # missing roadmap
    )

    with patch("yeet2_brain.interview._make_openai_client", return_value=fake_client):
        with pytest.raises(RuntimeError, match="incomplete"):
            interview_step({"project_name": "P", "chat_history": []})


def test_interview_step_raises_on_unknown_action(monkeypatch):
    _mock_llm_env(monkeypatch)

    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = _make_llm_response(
        '{"action": "think", "thoughts": "hmm"}'
    )

    with patch("yeet2_brain.interview._make_openai_client", return_value=fake_client):
        with pytest.raises(RuntimeError, match="unknown action"):
            interview_step({"project_name": "P", "chat_history": []})


def test_interview_step_invalid_template_key_set_to_none(monkeypatch):
    """If LLM returns an unknown suggested_template, it is set to None."""
    _mock_llm_env(monkeypatch)

    llm_json = """{
        "action": "synthesize",
        "suggested_template": "frobnicator",
        "files": {"vision": "v", "spec": "s", "roadmap": "r"}
    }"""
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = _make_llm_response(llm_json)

    with patch("yeet2_brain.interview._make_openai_client", return_value=fake_client):
        result = interview_step({"project_name": "P", "chat_history": []})

    assert result.suggested_template is None


def test_interview_step_all_valid_templates_accepted(monkeypatch):
    """Every valid template key is accepted as suggested_template."""
    _mock_llm_env(monkeypatch)

    for template in VALID_TEMPLATES:
        llm_json = f"""{{"action": "synthesize", "suggested_template": "{template}",
            "files": {{"vision": "v", "spec": "s", "roadmap": "r"}}}}"""
        fake_client = MagicMock()
        fake_client.chat.completions.create.return_value = _make_llm_response(llm_json)

        with patch("yeet2_brain.interview._make_openai_client", return_value=fake_client):
            result = interview_step({"project_name": "P", "chat_history": []})

        assert result.suggested_template == template


# ---------------------------------------------------------------------------
# serialize_interview_result
# ---------------------------------------------------------------------------


def test_serialize_ask():
    result = InterviewResult(action="ask", question="What is this?", interview_step=0, total_steps=5)
    d = serialize_interview_result(result)
    assert d["action"] == "ask"
    assert d["question"] == "What is this?"
    assert d["interviewStep"] == 0
    assert d["totalSteps"] == 5
    assert "files" not in d


def test_serialize_synthesize():
    files = {"vision": "# V", "spec": "# S", "roadmap": "# R"}
    result = InterviewResult(action="synthesize", total_steps=5, files=files, suggested_template="software")
    d = serialize_interview_result(result)
    assert d["action"] == "synthesize"
    assert d["files"] == files
    assert d["suggestedTemplate"] == "software"
    assert "question" not in d
    assert "interviewStep" not in d


def test_serialize_synthesize_no_template():
    result = InterviewResult(action="synthesize", total_steps=5, files={"vision": "", "spec": "", "roadmap": ""})
    d = serialize_interview_result(result)
    assert "suggestedTemplate" not in d


# ---------------------------------------------------------------------------
# _make_openai_client
# ---------------------------------------------------------------------------


def test_make_openai_client_uses_langfuse_when_keys_present(monkeypatch):
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
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)

    fake_client = MagicMock(name="openai-plain")
    fake_openai = MagicMock()
    fake_openai.OpenAI.return_value = fake_client

    with patch.dict(sys.modules, {"openai": fake_openai}):
        client = _make_openai_client("mykey", "https://example.com")

    assert client is fake_client
    fake_openai.OpenAI.assert_called_once_with(api_key="mykey", base_url="https://example.com")
