"""Canonical test completion entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class TestCompletionEntryData(BaseModel):
    """Canonical test completion entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    invocation_id: str | None = None
    end_reason: str | None = None
