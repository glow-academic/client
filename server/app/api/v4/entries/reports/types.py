"""Canonical reports entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class ReportsEntryData(BaseModel):
    """Canonical reports entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    upload_id: str | None = None
