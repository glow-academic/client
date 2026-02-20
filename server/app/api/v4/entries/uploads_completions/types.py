"""Canonical uploads completions entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class UploadsCompletionsEntryData(BaseModel):
    """Canonical uploads completions entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    upload_id: str | None = None
    end_reason: str | None = None
