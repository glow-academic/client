"""Canonical grants entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class GrantsEntryData(BaseModel):
    """Canonical grants entry fields. All optional for streaming support."""

    id: str | None = None
    expires_at: str | None = None
    used_at: str | None = None
    revoked_at: str | None = None
    created_at: str | None = None
    session_id: str | None = None
