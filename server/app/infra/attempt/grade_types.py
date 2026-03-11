"""Canonical attempt grading request types shared across transports."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel


class AttemptGradeFeedbackEntry(BaseModel):
    feedback: str
    total: int | None = None


class AttemptGradeStrengthEntry(BaseModel):
    name: str
    description: str
    message_id: UUID | None = None


class AttemptGradeImprovementEntry(BaseModel):
    name: str
    description: str
    message_id: UUID | None = None


class AttemptGradeAnalysisEntry(BaseModel):
    content: str


class AttemptGradeHighlightEntry(BaseModel):
    strength_id: UUID | None = None
    section: str
    idx: int | None = None


class AttemptGradeReplacementEntry(BaseModel):
    improvement_id: UUID | None = None
    section: str
    replace: str
    idx: int | None = None


class GradeAttemptRequest(BaseModel):
    attempt_id: UUID
    chat_id: UUID | None = None
    resource_types: list[str] | None = None
    user_instructions: list[str] | None = None
    score: int | None = None
    passed: bool | None = None
    time_taken: int | None = None
    feedbacks: list[AttemptGradeFeedbackEntry] | None = None
    strengths: list[AttemptGradeStrengthEntry] | None = None
    improvements: list[AttemptGradeImprovementEntry] | None = None
    analyses: list[AttemptGradeAnalysisEntry] | None = None
    highlights: list[AttemptGradeHighlightEntry] | None = None
    replacements: list[AttemptGradeReplacementEntry] | None = None
