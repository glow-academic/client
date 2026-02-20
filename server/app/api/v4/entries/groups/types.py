"""Canonical groups entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class GroupsEntryData(BaseModel):
    """Canonical groups entry fields. All optional for streaming support."""

    created_at: str | None = None
    id: str | None = None
    trace_id: str | None = None
    session_id: str | None = None
    name: str | None = None
    custom_model: bool | None = None
