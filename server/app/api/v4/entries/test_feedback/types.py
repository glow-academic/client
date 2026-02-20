"""Canonical test feedback entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class TestFeedbackEntryData(BaseModel):
    """Canonical test feedback entry fields. All optional for streaming support."""

    id: str | None = None
    grade_id: str | None = None
    total: int | None = None
    feedback: str | None = None
    created_at: str | None = None
    call_id: str | None = None
    total_points: int | None = None
    pass_points: int | None = None
