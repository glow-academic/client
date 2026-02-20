"""Canonical tests entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class TestsEntryData(BaseModel):
    """Canonical tests entry fields. All optional for streaming support."""

    created_at: str | None = None
    title: str | None = None
    completed: bool | None = None
    trace_id: str | None = None
    id: str | None = None
    attempt_id: str | None = None
    group_id: str | None = None
