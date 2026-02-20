"""Canonical test stop entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class TestStopEntryData(BaseModel):
    """Canonical test stop entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    invocation_id: str | None = None
    stopped: bool | None = None
