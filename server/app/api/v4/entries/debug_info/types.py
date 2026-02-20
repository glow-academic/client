"""Canonical debug info entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class DebugInfoEntryData(BaseModel):
    """Canonical debug info entry fields. All optional for streaming support."""

    created_at: str | None = None
    content: str | None = None
    id: str | None = None
    call_id: str | None = None
    run_id: str | None = None
