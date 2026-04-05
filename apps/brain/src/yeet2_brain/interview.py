"""Constitution interview module for the Brain service."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

INTERVIEW_QUESTIONS = [
    {
        "step": 0,
        "target": "template",
        "question": "What type of project is this? (software development, content/writing, solution architecture, research, marketing, legal/compliance, or something else)",
    },
    {
        "step": 1,
        "target": "vision",
        "question": "What is this project? Describe its purpose, who it serves, and what problem it solves.",
    },
    {
        "step": 2,
        "target": "vision+spec",
        "question": "What are the 3-5 most important features or capabilities this project should have?",
    },
    {
        "step": 3,
        "target": "spec",
        "question": "Are there any technical constraints, required integrations, or platforms this must support?",
    },
    {
        "step": 4,
        "target": "roadmap",
        "question": "What should be built first? Describe the first milestone or MVP scope.",
    },
    {
        "step": 5,
        "target": "roadmap+architecture",
        "question": "What does success look like in 2-4 weeks? Any architectural preferences (monolith, microservices, specific frameworks)?",
    },
]

TEMPLATE_KEYWORDS: dict[str, list[str]] = {
    "software": ["software", "code", "coding", "development", "app", "application", "api", "backend", "frontend", "web", "mobile"],
    "content": ["content", "writing", "blog", "article", "copy", "editorial", "media", "publication"],
    "architecture": ["architecture", "solution", "design", "system design", "technical design", "infrastructure"],
    "research": ["research", "study", "investigation", "analysis", "academic", "survey", "report"],
    "marketing": ["marketing", "campaign", "brand", "advertising", "seo", "social media", "growth"],
    "legal": ["legal", "compliance", "contract", "regulation", "policy", "law", "gdpr", "audit"],
    "data": ["data", "analytics", "dataset", "dashboard", "visualization", "chart", "metrics", "statistics"],
    "product": ["product", "feature", "ux", "user story", "wireframe", "prototype", "roadmap", "sprint"],
}

VALID_TEMPLATES = set(TEMPLATE_KEYWORDS.keys()) | {"custom"}


def _make_openai_client(api_key: str, base_url: str) -> Any:
    """Return an OpenAI-compatible client. Uses Langfuse wrapper when configured."""
    public_key = os.getenv("LANGFUSE_PUBLIC_KEY", "").strip()
    secret_key = os.getenv("LANGFUSE_SECRET_KEY", "").strip()
    host = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com").strip()
    if public_key and secret_key:
        try:
            from langfuse.openai import OpenAI as LangfuseOpenAI  # noqa: PLC0415
            return LangfuseOpenAI(api_key=api_key, base_url=base_url)
        except ImportError:
            pass
    import openai  # noqa: PLC0415
    return openai.OpenAI(api_key=api_key, base_url=base_url)


@dataclass
class InterviewResult:
    action: str  # "ask" or "synthesize"
    question: str | None = None
    interview_step: int | None = None
    total_steps: int = len(INTERVIEW_QUESTIONS)
    files: dict[str, str] | None = None  # {"vision": "# Vision\n...", "spec": "...", "roadmap": "..."}
    suggested_template: str | None = None  # pipeline template key suggested from interview


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


def _get_active_questions(existing_files: list[str], rerun: bool) -> list[dict[str, Any]]:
    """Return the subset of INTERVIEW_QUESTIONS to ask for this run.

    When rerun=True, skip questions whose every target file already exists.
    The template question (target: "template") is never skipped.
    """
    if not rerun:
        return list(INTERVIEW_QUESTIONS)

    active = []
    for q in INTERVIEW_QUESTIONS:
        target = q["target"]
        if target == "template":
            active.append(q)
            continue
        # Multi-target like "vision+spec" — skip only if ALL targets exist
        targets = [t.strip() for t in target.split("+")]
        if all(t in existing_files for t in targets):
            continue
        active.append(q)
    return active


def interview_step(payload: dict[str, Any]) -> InterviewResult:
    """Advance the constitution interview by one step.

    Examines chat_history to determine how many questions have been answered,
    returns the next question if any remain, or synthesizes constitution
    documents once all questions have been answered.
    """
    project_name = str(payload.get("project_name", "")).strip() or "Project"
    chat_history: list[dict[str, Any]] = payload.get("chat_history") or []
    existing_files: list[str] = payload.get("existing_files") or []
    rerun: bool = bool(payload.get("rerun", False))

    active_questions = _get_active_questions(existing_files, rerun)
    total = len(active_questions)

    answered = _count_answered(chat_history)

    if answered < total:
        q = active_questions[answered]
        return InterviewResult(
            action="ask",
            question=q["question"],
            interview_step=q["step"],
            total_steps=total,
        )

    # All questions answered — collect Q&A pairs
    qa_pairs: list[tuple[str, str]] = []
    current_question: str | None = None
    current_step: int | None = None
    project_type_answer: str | None = None

    for message in chat_history:
        detail = message.get("detail") or {}
        has_step = isinstance(detail, dict) and "interviewStep" in detail

        if _is_system_message(message) and has_step:
            current_question = _message_content(message)
            current_step = int(detail["interviewStep"]) if isinstance(detail, dict) else None
        elif not _is_system_message(message) and current_question is not None:
            answer = _message_content(message)
            if current_step == 0:
                project_type_answer = answer
            qa_pairs.append((current_question, answer))
            current_question = None
            current_step = None

    suggested_template = _suggest_template(project_type_answer)
    all_files = _synthesize_constitution(project_name, qa_pairs, suggested_template)

    # When rerunning, only return files that were actually asked about
    if rerun and existing_files:
        asked_targets: set[str] = set()
        for q in active_questions:
            if q["target"] == "template":
                continue
            for t in q["target"].split("+"):
                asked_targets.add(t.strip())
        files = {k: v for k, v in all_files.items() if k in asked_targets}
    else:
        files = all_files

    return InterviewResult(action="synthesize", total_steps=total, files=files, suggested_template=suggested_template)


def _suggest_template(project_type_answer: str | None) -> str:
    """Infer the closest pipeline template key from the user's project-type answer.

    Tries LLM classification first; falls back to keyword matching.
    """
    if not project_type_answer:
        return "software"
    llm_result = _llm_suggest_template(project_type_answer)
    if llm_result:
        return llm_result
    lower = project_type_answer.lower()
    for template_key, keywords in TEMPLATE_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return template_key
    return "custom"


def _llm_suggest_template(project_type_answer: str) -> str | None:
    """Use the LLM to classify the project type into a pipeline template key."""
    model = os.getenv("YEET2_BRAIN_CREWAI_MODEL") or os.getenv("LLM_MODEL") or None
    api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY") or None
    base_url = os.getenv("LLM_BASE_URL") or "https://openrouter.ai/api/v1"

    if not model or not api_key:
        return None

    try:
        templates = ", ".join(sorted(VALID_TEMPLATES))
        client = _make_openai_client(api_key, base_url)
        response = client.chat.completions.create(
            model=model,
            messages=[{
                "role": "user",
                "content": (
                    f"Choose the best pipeline template for this project.\n\n"
                    f"Available templates: {templates}\n\n"
                    f"Project description: {project_type_answer}\n\n"
                    "Reply with ONLY the template key (one word, lowercase). No explanation."
                )
            }],
            temperature=0,
            max_tokens=10,
        )
        result = (response.choices[0].message.content or "").strip().lower()
        return result if result in VALID_TEMPLATES else None
    except Exception:
        return None


def _synthesize_constitution(project_name: str, qa_pairs: list[tuple[str, str]], suggested_template: str | None = None) -> dict[str, str]:
    """Synthesize constitution documents from Q&A pairs.

    Tries LLM synthesis first; falls back to template synthesis.
    """
    result = _try_llm_synthesis(project_name, qa_pairs, suggested_template)
    if result is not None:
        return result
    return _template_synthesis(project_name, qa_pairs)


def _try_llm_synthesis(project_name: str, qa_pairs: list[tuple[str, str]], suggested_template: str | None = None) -> dict[str, str] | None:
    model = os.getenv("YEET2_BRAIN_CREWAI_MODEL") or os.getenv("LLM_MODEL") or None
    api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY") or None
    base_url = os.getenv("LLM_BASE_URL") or "https://openrouter.ai/api/v1"

    if not model or not api_key:
        return None

    try:
        qa_text = "\n\n".join(
            f"Q: {question}\nA: {answer}" for question, answer in qa_pairs
        )

        template_line = f"Pipeline type: {suggested_template}\n" if suggested_template else ""
        prompt = f"""You are synthesizing a project constitution from a structured interview.
Project name: {project_name}
{template_line}
Interview Q&A:
{qa_text}

Return ONLY a JSON object with three keys:
- "vision": a markdown document (# {project_name} Vision) covering purpose, audience, problem, and key capabilities — framed for a {suggested_template or "general"} project
- "spec": a markdown document (# {project_name} Spec) covering features and technical constraints appropriate for this type of project
- "roadmap": a markdown document (# {project_name} Roadmap) covering first milestone/MVP and near-term success criteria

Each value should be a complete markdown document, not a summary. Do not include any text outside the JSON object."""

        client = _make_openai_client(api_key, base_url)
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
    # qa_pairs indices: 0=project type, 1=purpose, 2=features, 3=constraints, 4=milestone, 5=goals
    answers = {i: answer for i, (_, answer) in enumerate(qa_pairs)}

    vision = f"""# {project_name} Vision

## Project Type

{answers.get(0, "Not specified.")}

## Purpose

{answers.get(1, "Not specified.")}

## Key Capabilities

{answers.get(2, "Not specified.")}
"""

    spec = f"""# {project_name} Spec

## Features

{answers.get(2, "Not specified.")}

## Technical Constraints

{answers.get(3, "Not specified.")}
"""

    roadmap = f"""# {project_name} Roadmap

## Milestone 1: First Delivery

{answers.get(4, "Not specified.")}

## Near-Term Goals

{answers.get(5, "Not specified.")}
"""

    return {"vision": vision, "spec": spec, "roadmap": roadmap}


def serialize_interview_result(result: InterviewResult) -> dict[str, Any]:
    d: dict[str, Any] = {"action": result.action, "totalSteps": result.total_steps}
    if result.action == "ask":
        d["question"] = result.question
        d["interviewStep"] = result.interview_step
    elif result.action == "synthesize":
        d["files"] = result.files
        if result.suggested_template:
            d["suggestedTemplate"] = result.suggested_template
    return d
