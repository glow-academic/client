"""Canonical document drafts entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class DocumentDraftsEntryData(BaseModel):
    """Canonical document drafts entry fields. All optional for streaming support."""

    id: str | None = None
    version: int | None = None
    created_at: str | None = None
    group_id: str | None = None
