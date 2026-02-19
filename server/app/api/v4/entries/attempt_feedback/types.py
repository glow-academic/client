"""Canonical feedbacks entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class FeedbacksEntryData(BaseModel):
    """Canonical feedbacks entry fields. All optional for streaming support."""

    feedback_id: str | None = None
    grade_id: str | None = None
    standard_id: str | None = None
    total: float | None = None
    feedback: str | None = None
    created_at: str | None = None
