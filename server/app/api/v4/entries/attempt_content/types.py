"""Canonical contents entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class ContentsEntryData(BaseModel):
    """Canonical contents entry fields. All optional for streaming support."""

    content_id: str | None = None
    message_id: str | None = None
    content: str | None = None
    persona_id: str | None = None
    idx: int | None = None
    created_at: str | None = None
