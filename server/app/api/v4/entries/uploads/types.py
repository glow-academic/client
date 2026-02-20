"""Canonical uploads entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class UploadsEntryData(BaseModel):
    """Canonical uploads entry fields. All optional for streaming support."""

    created_at: str | None = None
    file_path: str | None = None
    mime_type: str | None = None
    size: int | None = None
    id: str | None = None
