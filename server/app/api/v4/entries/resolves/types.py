"""Canonical resolves entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class ResolvesEntryData(BaseModel):
    """Canonical resolves entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    problem_id: str | None = None
    resolved: bool | None = None
