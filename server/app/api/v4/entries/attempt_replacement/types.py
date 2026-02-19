"""Canonical replacements entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class ReplacementsEntryData(BaseModel):
    """Canonical replacements entry fields. All optional for streaming support."""

    replacement_id: str | None = None
    improvement_id: str | None = None
    section: str | None = None
    replace_text: str | None = None
    idx: int | None = None
    created_at: str | None = None
