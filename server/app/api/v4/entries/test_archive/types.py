"""Canonical test archive entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class TestArchiveEntryData(BaseModel):
    """Canonical test archive entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    test_id: str | None = None
    archived: bool | None = None
