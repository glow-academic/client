"""Canonical analyses entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class AnalysesEntryData(BaseModel):
    """Canonical analyses entry fields. All optional for streaming support."""

    analysis_id: str | None = None
    grade_id: str | None = None
    content: str | None = None
    created_at: str | None = None
