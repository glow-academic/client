"""Canonical images entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class ImagesEntryData(BaseModel):
    """Canonical images entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    call_id: str | None = None
    upload_id: str | None = None
    message_id: str | None = None
