"""Brain orchestration role names."""

from __future__ import annotations

from enum import StrEnum


class Role(StrEnum):
    PLANNER = "Planner"
    ARCHITECT = "Architect"
    IMPLEMENTER = "Implementer"
    QA = "QA"
    REVIEWER = "Reviewer"
    VISUAL = "Visual"

