"""Constitution interview module for the Brain service."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

INTERVIEW_QUESTIONS = [
    {
        "step": 0,
        "target": "vision",
        "question": "What is this project? Describe its purpose, who it serves, and what problem it solves.",
    },
    {
        "step": 1,
        "target": "vision+spec",
        "question": "What are the 3-5 most important features or capabilities this project should have?",
    },
    {
        "step": 2,
        "target": "spec",
        "question": "Are there any technical constraints, required integrations, or platforms this must support?",
    },
    {
        "step": 3,
        "target": "roadmap",
        "question": "What should be built first? Describe the first milestone or MVP scope.",
    },
    {
        "step": 4,
        "target": "roadmap+architecture",
        "question": "What does success look like in 2-4 weeks? Any architectural preferences (monolith, microservices, specific frameworks)?",
    },
]


@dataclass
class InterviewResult:
    action: str  # "ask" or "synthesize"
    question: str | None = None
    interview_step: int | None = None
    total_steps: int = len(INTERVIEW_QUESTIONS)
    files: dict[str, str] | None = None  # {"vision": "# Vision\n...", "spec": "...", "roadmap": "..."}


def _is_system_message(message: dict[str, Any]) -> bool:
    actor = str(message.get("actor", message.get("role", ""))).strip().lower()
    detail = message.get("detail") or {}
    source = str(detail.get("source", "")).strip().lower() if isinstance(detail, dict) else ""
    return actor != "operator" and (source == "system" or (isinstance(detail, dict) and "interviewStep" in detail))


def _message_content(message: dict[str, Any]) -> str:
    return str(message.get("content", message.get("summary", ""))).strip()


def _count_answered(chat_history: list[dict[str, Any]]) -> int:
    """Count how many interview questions have been answered.

    A question is a system/planner message with detail.interviewStep set.
    An answer is the next operator message after a question.
    """
    answered = 0
    waiting_for_answer = False

    for message in chat_history:
        detail = message.get("detail") or {}
        has_step = isinstance(detail, dict) and "interviewStep" in detail

        if _is_system_message(message) and has_step:
            waiting_for_answer = True
        elif not _is_system_message(message) and waiting_for_answer:
            answered += 1
            waiting_for_answer = False

    return answered


def interview_step(payload: dict[str, Any]) -> InterviewResult:
    """Advance the constitution interview by one step.

    Examines chat_history to determine how many questions have been answered,
    returns the next question if any remain, or synthesizes constitution
    documents once all questions have been answered.
    """
    project_name = str(payload.get("project_name", "")).strip() or "Project"
    chat_history: list[dict[str, Any]] = payload.get("chat_history") or []

    answered = _count_answered(chat_history)
    total = len(INTERVIEW_QUESTIONS)

    if answered < total:
        q = INTERVIEW_QUESTIONS[answered]
        return InterviewResult(
            action="ask",
            question=q["question"],
            interview_step=q["step"],
            total_steps=total,
        )

    # All questions answered — collect Q&A pairs
    qa_pairs: list[tuple[str, str]] = []
    current_question: str | None = None

    for message in chat_history:
        detail = message.get("detail") or {}
        has_step = isinstance(detail, dict) and "interviewStep" in detail

        if _is_system_message(message) and has_step:
            current_question = _message_content(message)
        elif not _is_system_message(message) and current_question is not None:
            answer = _message_content(message)
            qa_pairs.append((current_question, answer))
            current_question = None

    files = _synthesize_constitution(project_name, qa_pairs)
    return InterviewResult(action="synthesize", total_steps=total, files=files)


def _synthesize_constitution(project_name: str, qa_pairs: list[tuple[str, str]]) -> dict[str, str]:
    """Synthesize constitution documents from Q&A pairs.

    Tries LLM synthesis first; falls back to template synthesis.
    """
    result = _try_llm_synthesis(project_name, qa_pairs)
    if result is not None:
        return result
    return _template_synthesis(project_name, qa_pairs)


def _try_llm_synthesis(project_name: str, qa_pairs: list[tuple[str, str]]) -> dict[str, str] | None:
    model = os.getenv("YEET2_BRAIN_CREWAI_MODEL") or os.getenv("LLM_MODEL") or None
    api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY") or None
    base_url = os.getenv("LLM_BASE_URL") or "https://openrouter.ai/api/v1"

    if not model or not api_key:
        return None

    try:
        import openai

        qa_text = "\n\n".join(
            f"Q: {question}\nA: {answer}" for question, answer in qa_pairs
        )

        prompt = f"""You are synthesizing a project constitution from a structured interview.
Project name: {project_name}

Interview Q&A:
{qa_text}

Return ONLY a JSON object with three keys:
- "vision": a markdown document (# {project_name} Vision) covering purpose, audience, problem, and key capabilities
- "spec": a markdown document (# {project_name} Spec) covering features and technical constraints
- "roadmap": a markdown document (# {project_name} Roadmap) covering first milestone/MVP and near-term success criteria

Each value should be a complete markdown document, not a summary. Do not include any text outside the JSON object."""

        client = openai.OpenAI(api_key=api_key, base_url=base_url)
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        raw = response.choices[0].message.content or ""

        # Extract JSON from the response (may be wrapped in markdown fences)
        from .planner import _json_fragment
        fragment = _json_fragment(raw)
        data = json.loads(fragment)

        vision = str(data.get("vision", "")).strip()
        spec = str(data.get("spec", "")).strip()
        roadmap = str(data.get("roadmap", "")).strip()

        if vision and spec and roadmap:
            return {"vision": vision, "spec": spec, "roadmap": roadmap}
        return None
    except Exception:
        return None


def _template_synthesis(project_name: str, qa_pairs: list[tuple[str, str]]) -> dict[str, str]:
    answers = {i: answer for i, (_, answer) in enumerate(qa_pairs)}

    vision = f"""# {project_name} Vision

## Purpose

{answers.get(0, "Not specified.")}

## Key Capabilities

{answers.get(1, "Not specified.")}
"""

    spec = f"""# {project_name} Spec

## Features

{answers.get(1, "Not specified.")}

## Technical Constraints

{answers.get(2, "Not specified.")}
"""

    roadmap = f"""# {project_name} Roadmap

## Milestone 1: First Delivery

{answers.get(3, "Not specified.")}

## Near-Term Goals

{answers.get(4, "Not specified.")}
"""

    return {"vision": vision, "spec": spec, "roadmap": roadmap}


def serialize_interview_result(result: InterviewResult) -> dict[str, Any]:
    d: dict[str, Any] = {"action": result.action, "totalSteps": result.total_steps}
    if result.action == "ask":
        d["question"] = result.question
        d["interviewStep"] = result.interview_step
    elif result.action == "synthesize":
        d["files"] = result.files
    return d
