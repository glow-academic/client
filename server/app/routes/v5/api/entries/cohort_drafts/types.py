"""Canonical cohort drafts entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class CohortDraftsEntryData(BaseModel):
    """Canonical cohort drafts entry fields. All optional for streaming support."""

    id: str | None = None
    version: int | None = None
    created_at: str | None = None
    group_id: str | None = None
