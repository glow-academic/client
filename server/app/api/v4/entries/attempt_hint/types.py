"""Canonical hints entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class HintsEntryData(BaseModel):
    """Canonical hints entry fields. All optional for streaming support."""

    hint_id: str | None = None
    message_id: str | None = None
    hint: str | None = None
    idx: int | None = None
    created_at: str | None = None
